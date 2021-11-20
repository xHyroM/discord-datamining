const hyttpo = require('hyttpo');
const beautify = require('js-beautify').js;
const fs = require('fs');
const chalk = require('chalk');
const core = require('@actions/core');
const github = require('@actions/github');

const log = (msg) => console.log(`${chalk.bgCyan(` LOG `)} ${msg}`);
const error = (msg) => console.log(`${chalk.bgRed(` ERR `)} ${msg}`);

(async() => {
    const github_token = core.getInput('GITHUB_TOKEN', {required: true});
    const octokit = github.getOctokit(github_token);

    log('Getting latest version...');

    const version = (await hyttpo.get('https://canary.discord.com/assets/version.canary.json')).data;
    const date = new Date();

    if(fs.existsSync(`${__dirname}/${date.getFullYear()}/${date.getMonth()}/${date.getDay()}/${version.hash}.js`)) {
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

    octokit.rest.repos.createOrUpdateFileContents({
        owner: "xHyroM",
        repo: "discord-assets",
        path: "current.js",
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
    })

    octokit.rest.repos.createOrUpdateFileContents({
        owner: "xHyroM",
        repo: "discord-assets",
        path: `${date.getFullYear()}/${date.getMonth()}/${date.getDay()}/${version.hash}.js`,
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
    })

    log('Done!');
})();