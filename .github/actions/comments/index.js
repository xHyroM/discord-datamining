// Grabbed from https://github.com/Discord-Datamining/comments-action/blob/main/src/index.ts

const core = require("@actions/core");
const { context, getOctokit } = require("@actions/github")
const differ = require("@adryd325/discord-datamining-lang-differ");
const hyttpo = require('hyttpo');

const token = process.env.GITHUB_TOKEN
const filePathRegex = /\/\d{4}\/(?:\d{4}-\d{2}-\d{2}|\d{2}\/\d{2})\/[a-z0-9]{20,}\.js$/

async function run() {
    try {
        if (!token) return core.setFailed("Invalid GITHUB_TOKEN")

        const octokit = getOctokit(token)
        const { owner, repo } = context.repo

        if (context.eventName !== "push") return

        const payload = context.payload;
        const commitSha = payload.after;

        const commit = await octokit.rest.repos.getCommit({
            owner,
            repo,
            ref: commitSha
        })

        if (!commit)
            return core.setFailed("commit not found")

        const commitFile = commit.data.files[0]
        console.log(commitFile)

        if (!commitFile || commitFile.status !== "added") core.info("not a build commit")

        const { blob_url, sha: fileSha } = commit.data.files[0]

        if (!filePathRegex.test(blob_url))
            core.info("not a build file")

        const currentTree = await octokit.rest.git.getTree({
            owner,
            repo,
            tree_sha: payload.before,
        })
        const currentFileSha = currentTree?.data?.tree?.find?.(file => file.path === "current.js")?.sha

        if (!currentFileSha)
            core.info("no current file")

        const currentFile = await octokit.rest.git.getBlob({
            owner,
            repo,
            file_sha: currentFileSha
        })
        const newFile = await octokit.rest.git.getBlob({
            owner,
            repo,
            file_sha: fileSha,
        })

        const currentContent = Buffer.from(currentFile.data.content, "base64").toString("utf8")
        const newContent = Buffer.from(newFile.data.content, "base64").toString("utf8")
        if (core.isDebug()) {
            core.debug(`${currentContent.length}`)
            core.debug(`${newContent.length}`)
        }

        let diff
        try {
            diff = differ(
                currentContent,
                newContent,
                "codeblock",
            )
        } catch (e) {
            return core.setFailed(`unable to diff strings: ${e}`)
        }

        if (!diff)
            return core.info("no strings changed")

        await octokit.rest.repos.createCommitComment({
            owner,
            repo,
            commit_sha: commitSha,
            body: diff
        })
        return core.info("created commit comment")
    } catch (error) {
        core.setFailed(core.isDebug() ? error.stack : error.message)
    }
}
run() 