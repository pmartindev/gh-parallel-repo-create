import { Octokit } from "@octokit/rest";
import dotenv from "dotenv";
import randomwords from "random-words";
import simpleGit, { SimpleGit } from 'simple-git';
const yargs = require('yargs')

const collectResults = async () => {
    dotenv.config();
    const { 
        endpoint, 
        authToken, 
        org,
        repoUrls
     } = acceptCommandLineArgs();
    const octokit: Octokit = new Octokit({
        auth: authToken,
        baseUrl: endpoint
    });
    const clonePromises: Promise<string>[] = repoUrls.map((repoUrl: string) => cloneRepo(octokit, repoUrl));
    const apiPromises: Promise<string>[] = Array.from({ length: 5 }, () => runApiRequest(octokit, org));
    return Promise.all([...apiPromises, ...clonePromises]);
};


const run = async () => {
    console.log('Collecting results...');
    const results: string[] = await collectResults();
    console.log(results);
    console.log('Done');
};

async function runApiRequest(octokit: Octokit, org: string) {
    const name = randomwords({ exactly: 2, join: '-' });
    const result: string = (await octokit.repos.createInOrg({
        name,
        org,
        description: 'This is a migration test repo.',
    })).data.name;
    return result;
}

async function cloneRepo(octokit: Octokit, repoUrl: string) {
    const git: SimpleGit = simpleGit();
    console.log(`Cloning ${repoUrl}...`)
    const result: string = await git.clone(repoUrl);
    console.log(`Cloned ${repoUrl}`)
    return result
}

export function acceptCommandLineArgs(): { 
    endpoint: string, 
    authToken: string, 
    org: string,
    repoUrls: string[] } {
    const argv = yargs.default(process.argv.slice(2))
        .env('GITHUB')
        .option('endpoint', {
            alias: 'e',
            env: 'GITHUB_ENDPOINT',
            description: 'The api endpoint of the github instance (ex. api.github.com)',
            type: 'string',
            demandOption: true,
        })
        .option('authToken', {
            alias: 't',
            env: 'GITHUB_AUTH_TOKEN',
            description: 'The personal access token for the GHES Migration API.',
            type: 'string',
            demandOption: true,
        }).option('org', {
            alias: 'o',
            env: 'GITHUB_ORG',
            description: 'The org slug to create the repo in (ex. my-org)',
            type: 'string',
            demandOption: true,
        }).option('repoUrls', {
            alias: 'r',
            env: 'GITHUB_REPO_URLS',
            description: 'A comma separated list of repo urls to clone. (ex. https://github.com/torvalds/linux,https://github.com/microsoft/vscode)',
            type: 'string',
            demandOption: true,
        })
        .option('repoUrls', {
            alias: 'r',
            env: 'GITHUB_REPO_URLS',
            description: 'A comma separated list of repo urls to clone. (ex. https://github.com/torvalds/linux,https://github.com/microsoft/vscode)',
            type: 'string',
            demandOption: true,
        }).argv;
    return { 
        endpoint: argv.endpoint, 
        authToken: argv.authToken,
        org: argv.org,
        repoUrls: argv.repoUrls.split(',').map((url: string) => url.trim())
    };
}

// The main entrypoint for the application
run();