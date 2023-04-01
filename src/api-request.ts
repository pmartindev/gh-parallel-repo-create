import { Octokit } from '@octokit/rest';
import randomwords from 'random-words';

export const createRepoApi = async (octokit: Octokit, org: string): Promise<string> => {
    const name = randomwords({ exactly: 2, join: '-' });
    const result: string = (await octokit.repos.createInOrg({
        name,
        org,
        description: 'This is a migration test repo.',
    })).data.name;
    return result;
};
