import { Octokit } from "@octokit/rest";
import dotenv from "dotenv";
import simpleGit, { SimpleGit, SimpleGitOptions } from 'simple-git';
import fs from 'fs';
import path from "path";
import { createRepoApi } from "./api-request";
import { Worker } from 'worker_threads';

const yargs = require('yargs')

const cloneAndCreateRepos = async (gitReposDir: string, octokit: Octokit, args: {
    apiEndpoint: string;
    endpoint: string;
    authToken: string;
    org: string;
    repoUrls: string;
    numberOfRepos: number;
}) => {
    await createOrDeleteDir(gitReposDir);
    const { org, repoUrls, numberOfRepos } = args;
    const clonePromises: Promise<string>[] = repoUrls.split(',').map((repoUrl: string) => cloneRepo(repoUrl, gitReposDir));
    const apiPromises: Promise<string>[] = Array.from({ length: numberOfRepos }, () => createRepoApi(octokit, org));
    // gather all promise results and filter out empty strings
    const allPromiseResults = (await Promise.all([...apiPromises, ...clonePromises])).filter((result: string) => result !== "");
    return allPromiseResults
};

const pushClonedRepos = async (gitReposDir: string, octokit: Octokit, createdRepos: string[], args: {
    apiEndpoint: string;
    endpoint: string;
    authToken: string;
    org: string;
    repoUrls: string;
    numberOfRepos: number;
}) => {
    const { endpoint, authToken, org} = args;
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

export const pushRepoToRemote = async (clonedRepo: string, createdRepo: string, endpoint: string, authToken: string, org: string, gitReposDir: string): Promise<string> => {
    console.log("Pushing repo to remote")
    const worker = new Worker('./dist/push-worker', {
        workerData: { clonedRepo, createdRepo, endpoint, authToken, org, gitReposDir }
    });
    console.log("Worker created")
    return new Promise((resolve, reject) => {
        worker.on('message', (message) => {
            console.log("Worker message received")
            resolve(message);
        });
        worker.on('error', (error) => {
            console.log("Worker error")
            reject(error);
        });
        worker.on('exit', (code) => {
            console.log("Worker exited")
            if (code !== 0) {
                reject(new Error(`Worker stopped with exit code ${code}`));
            }
        });
    });
};

const run = async () => {
    const gitReposDir: string = path.join(__dirname, "repos");
    dotenv.config();
    const { apiEndpoint, authToken } = acceptCommandLineArgs();
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
    repoUrls: string,
    numberOfRepos: number } {
    const argv = yargs
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
        .option('numberOfRepos', {
            alias: 'n',
            env: 'GITHUB_NUMBER_OF_REPOS',
            description: 'The number of repos to create. (ex. 10)',
            type: 'number',
            default: 10,
            demandOption: false,
        }).argv;
        const { apiEndpoint, endpoint, authToken, org, repoUrls, numberOfRepos } = argv;
        return { apiEndpoint, endpoint, authToken, org, repoUrls, numberOfRepos };
}

// The main entrypoint for the application
run();