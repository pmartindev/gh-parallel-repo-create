import { parentPort, workerData } from 'worker_threads';
import {simpleGit, SimpleGit} from 'simple-git';

interface WorkerData {
    clonedRepo: string;
    createdRepo: string;
    endpoint: string;
    authToken: string;
    org: string;
    gitReposDir: string;
}

const { clonedRepo, createdRepo, endpoint, authToken, org, gitReposDir }: WorkerData = workerData;


async function pushRepoToRemote(workerData: WorkerData) {
    const git = simpleGit(`${gitReposDir}/${clonedRepo}`);
    const defaultBranch = await git.branchLocal();
    console.log(`Pushing ${clonedRepo} to https://${endpoint}/${org}/${createdRepo}..`);
    await git.push(`https://ghe-admin:${authToken}@${endpoint}/${org}/${createdRepo}.git`, `${defaultBranch.current}`);
    console.log(`Pushed ${clonedRepo} to https://${endpoint}/${org}/${createdRepo}`);
    return `${org}/${createdRepo}`;
}

pushRepoToRemote(workerData);