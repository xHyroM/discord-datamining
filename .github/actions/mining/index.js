const hyttpo = require('hyttpo');
const beautify = require('js-beautify').js;
const fs = require('fs');
const chalk = require('chalk');
const core = require('@actions/core');
const github = require('@actions/github');
const wait = require('util').promisify(setTimeout);

const log = (msg) => console.log(`${chalk.bgCyan(` LOG `)} ${msg}`);
const error = (msg) => console.log(`${chalk.bgRed(` ERR `)} ${msg}`);

(async() => {
    const github_token = core.getInput('GITHUB_TOKEN', {required: true});
    const octokit = github.getOctokit(github_token);

    log('Getting latest version...');

    const version = (await hyttpo.get('https://canary.discord.com/assets/version.canary.json')).data;
    const date = new Date();

    if(fs.existsSync(`mining/${date.getFullYear()}/${date.getMonth() + 1}/${date.getDate()}/${version.hash}.js`)) {
        error('I didn\'t find any changes.');
        
        return process.exit(0);
    };

    log('Getting scripts...');
    const req = await hyttpo.get('https://canary.discord.com/login');
    const script = req.data.replace(/<|>|!|--|div|meta|svg|}|nonce|function/g, '').split('\n');

    let file;
    for(let s of script) {
        if(s.includes('assets') && s.includes('.js') && s.includes('integrity') && s.includes('script') && s.includes('assets') && s.includes('sha512-') && s.includes('/script')) {
            file = s.split('src="/assets/').slice(-1)[0].split('"')[0];
            break;
        }
    }

    log('Beautify...');
    let reqFile = await hyttpo.get('https://canary.discord.com/assets/'+file);
    let data = beautify(reqFile.data, { indent_size: 2, space_in_empty_paren: true });

    log('Writing...');

    data = Buffer.from(data).toString('base64');

    let commits = await octokit.rest.repos.listCommits({
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
                path: 'mining/current.js',
                mode: '100644',
                content: data
            }
        ]
    })

    const newTreeSha = commits.data.sha
    
    commits = await octokit.rest.git.createCommit({
        owner: "xHyroM",
        repo: "discord-assets",
        message: `Build ${version.hash}`,
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
    })

    await wait(500);

    const commitInfo = await octokit.rest.repos.createOrUpdateFileContents({
        owner: "xHyroM",
        repo: "discord-assets",
        path: `mining/${date.getFullYear()}/${date.getMonth() + 1}/${date.getDate()}/${version.hash}.js`,
        message: `Build ${version.hash}`,
        content: data,
        committer: {
            name: "xHyroM",
            email: "generalkubo@gmail.com"
        },
        author: {
            name: "xHyroM",
            email: "generalkubo@gmail.com"
        }
    }).catch(e => console.log(e))

    await wait(500);

    const content = await octokit.rest.repos.getContent({
        owner: "xHyroM",
        repo: "discord-assets",
        path: `website/data/builds.json`,
    })

    await wait(500);

    let buildsData = JSON.parse(Buffer.from(content.data.content, 'base64').toString('utf-8'));
    if(!buildsData.builds) buildsData.builds = [];

    if(!buildsData.builds.some(d => d.hash === version.hash)) buildsData.builds.push({ 
        hash: version.hash,
        path: `mining/${date.getFullYear()}/${date.getMonth() + 1}/${date.getDate()}/${version.hash}.js`,
        commit: commitInfo.data.commit.sha
    })

    await octokit.rest.repos.createOrUpdateFileContents({
        owner: "xHyroM",
        repo: "discord-assets",
        path: `website/data/builds.json`,
        message: `Build ${version.hash}`,
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