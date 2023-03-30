import { Octokit } from "@octokit/rest";
import dotenv from "dotenv";
import randomwords from "random-words";
import simpleGit, { SimpleGit, SimpleGitOptions } from 'simple-git';
import fs from 'fs';
import path from "path";
const yargs = require('yargs')

const cloneAndCreateRepos = async (gitReposDir: string, octokit: Octokit, args: {
    apiEndpoint: string;
    endpoint: string;
    authToken: string;
    org: string;
    repoUrls: string[];
}) => {
    await createOrDeleteDir(gitReposDir);
    const { apiEndpoint, endpoint, authToken, org, repoUrls } = args;
    const clonePromises: Promise<string>[] = repoUrls.map((repoUrl: string) => cloneRepo(repoUrl, gitReposDir));
    const apiPromises: Promise<string>[] = Array.from({ length: 5 }, () => createOrgRepo(octokit, org));
    // gather all promise results and filter out empty strings
    const allPromiseResults = (await Promise.all([...apiPromises, ...clonePromises])).filter((result: string) => result !== "");
    return allPromiseResults
};

const pushClonedRepos = async (gitReposDir: string, octokit: Octokit, createdRepos: string[], args: {
    apiEndpoint: string;
    endpoint: string;
    authToken: string;
    org: string;
    repoUrls: string[];
}) => {
    const { apiEndpoint, endpoint, authToken, org, repoUrls } = args;
    // read all of the clone dirs in the repos dir
    const clonedRepos = fs.readdirSync(gitReposDir, { withFileTypes: true }).filter((dirent) => dirent.isDirectory()).map((dirent) => dirent.name);;

    const repos = createdRepos.map((repo, index) => {
        const clonedRepo = clonedRepos[index % clonedRepos.length];
        return { createdRepo: repo, clonedRepo };
      });

    const pushPromises: Promise<string>[] = repos.map(({ createdRepo, clonedRepo }) => pushRepoToRemote(clonedRepo, createdRepo, endpoint, authToken, org, gitReposDir));
    const pushPromiseResults = await Promise.all(pushPromises);
    await createOrDeleteDir(gitReposDir);
    return pushPromiseResults;
};

async function pushRepoToRemote(clonedRepo: string, createdRepo: string, endpoint: string, authToken: string, org: string, gitReposDir: string) {
    const git: SimpleGit = simpleGit(`${gitReposDir}/${clonedRepo}`);
    const defaultBranch = await git.branchLocal();
    console.log(`Pushing ${clonedRepo} to https://${endpoint}/${org}/${createdRepo}..`);
    await git.push(`https://ghe-admin:${authToken}@${endpoint}/${org}/${createdRepo}.git`, `${defaultBranch.current}`);
    console.log(`Pushed ${clonedRepo} to https://${endpoint}/${org}/${createdRepo}`);
    return `${org}/${createdRepo}`;
}

const run = async () => {
    const gitReposDir: string = path.join(__dirname, "repos");
    dotenv.config();
    const { apiEndpoint, authToken, org, repoUrls } = acceptCommandLineArgs();
    const octokit: Octokit = new Octokit({
        auth: authToken,
        baseUrl: apiEndpoint
    });
    console.log('Collecting results...');
    const createdRepos: string[] = await cloneAndCreateRepos(gitReposDir, octokit, acceptCommandLineArgs());
    const pushedRepos: string[] = await pushClonedRepos(gitReposDir, octokit, createdRepos, acceptCommandLineArgs());
    await console.log(pushedRepos);
    await console.log('Done');
};

async function createOrgRepo(octokit: Octokit, org: string) {
    const name = randomwords({ exactly: 2, join: '-' });
    const result: string = (await octokit.repos.createInOrg({
        name,
        org,
        description: 'This is a migration test repo.',
    })).data.name;
    console.log(`Created repo ${result}`);
    return result;
}

async function cloneRepo(repoUrl: string, gitReposDir: string) {
    const git: SimpleGit = simpleGit();
    const repoName: string = repoUrl.split('/').pop() as string;
    console.log(`Cloning ${repoUrl}...`);
    await git.clone(repoUrl, `${gitReposDir}/${repoName}`);
    console.log(`Cloned ${repoUrl} to ${gitReposDir}/${repoName}`);
    return "";
}

const createOrDeleteDir = async (dirPath: string): Promise<void> => {
    try {
        if (!fs.existsSync(dirPath)) {
            await fs.promises.mkdir(dirPath);
            console.log(`Directory ${dirPath} created!`);
        } else {
            console.log(`Directory ${dirPath} already exists, deleting...`);
            await fs.promises.rm(dirPath, { recursive: true });
        }
    } catch (err) {
        console.error(`Error in createOrDeleteDir: ${err}`);
        throw err;
    }
};

export function acceptCommandLineArgs(): {
    apiEndpoint: string,
    endpoint: string,
    authToken: string,
    org: string,
    repoUrls: string[]
} {
    const argv = yargs.default(process.argv.slice(2))
        .env('GITHUB')
        .option('apiEndpoint', {
            alias: 'a',
            env: 'GITHUB_API_ENDPOINT',
            description: 'The api endpoint of the github instance (ex. api.github.com)',
            type: 'string',
            demandOption: true,
        })
        .option('endpoint', {
            alias: 'e',
            env: 'GITHUB_ENDPOINT',
            description: 'The endpoint of the github instance (ex. github.com). NOTE: This is not the api endpoint.',
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
        .argv;
    return {
        apiEndpoint: argv.apiEndpoint,
        endpoint: argv.endpoint,
        authToken: argv.authToken,
        org: argv.org,
        repoUrls: argv.repoUrls.split(',').map((url: string) => url.trim())
    };
}

// The main entrypoint for the application
run();