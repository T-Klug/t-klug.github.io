---
title: Using Typescript and TS-Node in GitHub Actions
date: 2024-11-12
categories: [Technology, DevOps]
tags: [githubactions, cicd, typescript]     # TAG names should always be lowercase
author: TJ
image: /assets/img/ga-typescript.jpeg
---

## Introduction

GitHub Actions are awesome! They're definitely one of my favorite ways of accomplishing repeatable builds, deployments, and testing for both user experience and security. One of the issues I ran into though was that not many of the developers understood scripts that would end up in the YML files. I really wanted a way that teams could expand upon our shared GitHub Actions. I wanted the logic to be in something that was easily testable, easy for the teams to understand, and in a language they use everyday. 

## Enter ts-node

[ts-node](https://typestrong.org/ts-node/) is a fantastic library that lets you execute TypeScript files. With that in mind, we can create a shared action that is a composite, enabling us to create `ts-node script.ts` actions. The first thing you'll want to do is set up the shared action.

```yml
#action.yml
name: 'Determine Developers'
description: 'Determines developer or developers to deploy to'
inputs:
  github-username:
    description: 'GitHub Username'
    required: false
  teams:
    description: 'Teams to deploy to (Team A, Team B, Team C)'
    required: false
outputs:
  selected_account:
    description: 'Selected AWS Account'
    value: ${{ steps.determine-developers.outputs.selected_account }}
  selected_user:
    description: 'Selected User'
    value: ${{ steps.determine-developers.outputs.selected_user }}
  matrix:
    description: 'Matrix of users and accounts'
    value: ${{ steps.determine-developers.outputs.matrix }}

runs:
  using: 'composite'
  steps:
    - name: Install Packages
      run: npm ci
      shell: bash
      working-directory: ${{ github.action_path }}

    - name: Determine Developers
      id: determine-developers
      shell: bash
      env:
        GITHUB_ACTOR: ${{ inputs.github-username }}
        TEAMS: ${{ inputs.teams }}
      run: |
        npx ts-node determine-dev-env.ts
      working-directory: ${{ github.action_path }}
```

This example demonstrates a shared action to determine a developer or multiple developers to deploy to. The first part to keep in mind is to define both your inputs and outputs since it's a composite action. This action in particular will return a single developer's or multiple developers' information for deployment based on either the GitHub username or the selected teams.

## The Runs Section

The first step of the action is to install the necessary packages - you simply include a package.json in the action folder for this. You can then do `npm ci` and the working directory will be `${{github.action_path}}`. This is very convenient as it keeps your action's packages separate from the consumer's packages. Next, we use a bash script with a single line: `npx ts-node determine-dev-env.ts`, again using the action_path. This setup allows you to run TypeScript files directly, opening up lots of possibilities for testing and complex logic.

## The TypeScript File

We can now create our determine-dev-env.ts file. It should take the two ENV variables and determine if it should return a matrix of developers and their account information or a single user's account information.

```typescript
//determine-dev-env.ts
import * as core from '@actions/core';
import { DEVELOPERS } from './constants';

/**
 * Determine the developer or developer's environment to deploy to
 * @returns {Promise<void>}
 */
export async function main() {
  const githubUserName = process.env.GITHUB_ACTOR;
  const selectedTeams = process.env.TEAMS;
  core.info(`Github Username: ${githubUserName}`);
  core.info(`Selected Teams: ${selectedTeams}`);
  if (!githubUserName && !selectedTeams) {
    core.setFailed('Teams or Github username was not provided');
    return;
  }

  // Team use case - make sure this stays before the single user case as GITHUB_ACTOR is set no matter what
  if (selectedTeams) {
    const teams = selectedTeams.split(',');
    const deployMatrix = DEVELOPERS.filter((dev) => teams.includes(dev.team));
    core.setOutput('matrix', deployMatrix);
    return;
  }

  // Single User use case
  if (githubUserName) {
    const devEnv = DEVELOPERS.find(
      (dev) => dev.githubUsername === githubUserName
    );
    if (!devEnv) {
      core.setFailed(`Developer environment not found for ${githubUserName}`);
      return;
    }
    core.setOutput('selected_user', devEnv.shortName);
    core.setOutput('selected_account', devEnv.awsAccount);
    return;
  }

  // Fail the build if no username or teams are provided
  core.setFailed('No github username or teams provided');
}
main().catch((error) => {
  core.setFailed(error.message);
});
```

The script is pretty simple but gets the point across. It takes in the two ENV variables and checks if they are present. If the teams variable is present, we set the matrix output, and if the githubUserName is present, we set that as well. This is straightforward code, but it allows us to write tests against it.

## Testing Our Action

With our script now written, we can create several Jest tests to ensure our action always works as expected:

```typescript
//determine-dev-env.test.ts
import * as core from '@actions/core';
import { DEVELOPERS } from './constants';
import { main } from './determine-dev-env';

jest.mock('@actions/core');

describe('main', () => {
  const mockSetOutput = core.setOutput as jest.MockedFunction<
    typeof core.setOutput
  >;
  const mockSetFailed = core.setFailed as jest.MockedFunction<
    typeof core.setFailed
  >;
  const mockInfo = core.info as jest.MockedFunction<typeof core.info>;

  beforeEach(() => {
    jest.resetAllMocks();
    process.env.GITHUB_ACTOR = '';
    process.env.TEAMS = '';
  });

  it('should fail if no github username or teams are provided', async () => {
    await main();
    expect(mockSetFailed).toHaveBeenCalledWith(
      'Teams or Github username was not provided'
    );
  });

  it('should set output for single user use case', async () => {
    process.env.GITHUB_ACTOR = 'testuser';
    const developer = {
      githubUsername: 'testuser',
      shortName: 'test',
      awsAccount: '1234567890',
    };
    (DEVELOPERS as any) = [developer];

    await main();

    expect(mockSetOutput).toHaveBeenCalledWith(
      'selected_user',
      developer.shortName
    );
    expect(mockSetOutput).toHaveBeenCalledWith(
      'selected_account',
      developer.awsAccount
    );
  });

  // ... [rest of the test cases remain the same]
});
```

## Putting It All Together

Now that we have our action set up with TypeScript and proper testing, teams can easily understand, modify, and extend the functionality. The combination of TypeScript, ts-node, and Jest gives us:

1. Type safety and better IDE support
2. Familiar syntax for developers
3. Robust testing capabilities
4. Easy maintenance and updates
5. Clear separation of concerns

## Conclusion

Using TypeScript with GitHub Actions through ts-node has been a game-changer for our team. It's made our actions more maintainable, testable, and most importantly, more approachable for our developers. The ability to write complex logic in TypeScript rather than bash scripts or pure YAML has significantly improved our workflow and reduced errors.

The next time you're thinking about creating a shared GitHub Action, consider using TypeScript with ts-node. It might just make your life (and your team's lives) a whole lot easier!