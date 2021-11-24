const hyttpo = require('hyttpo');
const beautify = require('js-beautify').js;
const fs = require('fs');
const chalk = require('chalk');
const core = require('@actions/core');
const github = require('@actions/github');
const cheerio = require('cheerio');
const wait = require('util').promisify(setTimeout);

const log = (msg) => console.log(`${chalk.bgCyan(` LOG `)} ${msg}`);
const error = (msg) => console.log(`${chalk.bgRed(` ERR `)} ${msg}`);

(async() => {
    const github_token = core.getInput('GITHUB_TOKEN', {required: true});
    const octokit = github.getOctokit(github_token);
    require("octokit-commit-multiple-files")(octokit);

    log('Getting latest version...');

    const version = (await hyttpo.get('https://canary.discord.com/assets/version.canary.json')).data;
    const date = new Date();

    log('Getting scripts...');
    /*const req = await hyttpo.get('https://canary.discord.com/login');
    const script = req.data.replace(/<|>|!|--|div|meta|svg|}|nonce|function/g, '').split('\n');

    let file;
    for(let s of script) {
        if(s.includes('assets') && s.includes('.js') && s.includes('integrity') && s.includes('script') && s.includes('assets') && s.includes('sha512-') && s.includes('/script')) {
            file = s.split('src="/assets/').slice(-1)[0].split('"')[0];
            break;
        }
    }*/

    const cheerio = require('cheerio');
    const $ = cheerio.load(req.data);

    let file = $('script').get().filter(s => s.attribs.src && s.attribs.integrity && s.attribs.integrity.includes('sha512-')).slice(-1)[0].attribs.src;

    log('Beautify...');
    let reqFile = await hyttpo.get('https://canary.discord.com'+file);
    let data = beautify(reqFile.data, { indent_size: 2, space_in_empty_paren: true });

    let fileName = data.split('\n')[0].split('see')[1].split('.LICENSE')[0].replace(/\s/g, '');

    log('Checking...');

    data = Buffer.from(data).toString('base64');

    const currentFileContent = fs.readFileSync('current.js').toString('base64');
    if(currentFileContent === data) {
        error('I didn\'t find any changes.');
        
        return process.exit(0);
    };

    log('Writing...');

    /*let commits = await octokit.rest.repos.listCommits({
        owner: "xHyroM",
        repo: "discord-assets",
        sha: "master",
        per_page: 1
    })
    let latestCommitSha = commits.data[0].sha
    const treeSha = commits.data[0].commit.tree.sha

    commits = await octokit.rest.git.createTree({
        owner: "xHyroM",
        repo: "discord-assets",
        base_tree: treeSha,
        tree: [
            {
                path: `${date.getFullYear()}/${date.getMonth() + 1}/${date.getDate()}/${fileName}`,
                mode: '100644',
                content: Buffer.from(data, 'base64').toString('utf-8')
            },
            {
                path: 'current.js',
                mode: '100644',
                content: Buffer.from(data, 'base64').toString('utf-8')
            }
        ]
    })

    const newTreeSha = commits.data.sha
    
    commits = await octokit.rest.git.createCommit({
        owner: "xHyroM",
        repo: "discord-assets",
        message: `${date.getMonth() + 1}/${date.getDate()} | Build ${version.hash}`,
        tree: newTreeSha,
        parents: [latestCommitSha]
    })
    latestCommitSha = commits.data.sha

    await octokit.rest.git.updateRef({
        owner: "xHyroM",
        repo: "discord-assets",
        sha: latestCommitSha,
        ref: `heads/master`,
        force: true
    })*/

    fileName = `${date.getFullYear()}/${date.getMonth() + 1}/${date.getDate()}/${fileName}`

    let files = {};
    files[fileName] = { contents: Buffer.from(data, 'base64').toString() };
    files['current.js'] = {
        contents: Buffer.from(data, 'base64').toString('utf-8'),
      },

    await octokit.rest.repos.createOrUpdateFiles({
        owner: "xHyroM",
        repo: "discord-assets",
        branch: "master",
        createBranch: false,
        changes: [
          {
            message: `${date.getMonth() + 1}/${date.getDate()} | Build ${version.hash}`,
            files: files,
          }
        ],
    });

    await wait(500);

    const commits = await octokit.rest.repos.listCommits({
        owner: "xHyroM",
        repo: "discord-assets",
        sha: "master",
        per_page: 1
    })
    const latestCommitSha = commits.data[0].sha

    const content = await octokit.rest.repos.getContent({
        owner: "xHyroM",
        repo: "discord-assets",
        path: `website/data/builds.json`,
    })

    let buildsData = JSON.parse(Buffer.from(content.data.content, 'base64').toString('utf-8'));
    if(!buildsData.builds) buildsData.builds = [];

    if(!buildsData.builds.some(d => d.hash === version.hash)) buildsData.builds.push({ 
        hash: version.hash,
        path: `${date.getFullYear()}/${date.getMonth() + 1}/${date.getDate()}/${fileName}`,
        commit: latestCommitSha
    })

    await octokit.rest.repos.createOrUpdateFileContents({
        owner: "xHyroM",
        repo: "discord-assets",
        path: `website/data/builds.json`,
        message: `${date.getMonth() + 1}/${date.getDate()} | Build ${version.hash}`,
        sha: content.data.sha,
        content: Buffer.from(JSON.stringify(buildsData)).toString('base64'),
        committer: {
            name: "xHyroM",
            email: "generalkubo@gmail.com"
        },
        author: {
            name: "xHyroM",
            email: "generalkubo@gmail.com"
        }
    }).catch(e => console.log(e))

    log('Done!');
})();