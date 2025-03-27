---
title: Updating Downstream Repos with Github Actions
date: 2025-03-27
categories: [Technology, DevOps]
tags: [githubactions, cicd, typescript]     # TAG names should always be lowercase
author: TJ
image: /assets/img/downstream.png
---

# The Problem

When working with multiple repositories that depend on shared packages, keeping dependencies updated can become a tedious manual process. Every time you release a new version of your package, you need to update each downstream repository individually. This creates friction in the development process and can lead to repositories using outdated dependencies. I wanted an automated solution that would create pull requests in all downstream repositories whenever a new package version was released.

# GitHub Actions

GitHub Actions provides powerful automation capabilities that are perfect for solving this problem. By combining a few key workflows, we can automatically trigger dependency updates across multiple repositories whenever a new package version is published. This automation saves time and ensures consistent dependency management across all projects.

# Update Dependency Workflow

First, we need a workflow that can be triggered to update a specific package in a repository. This workflow will:

1. Create a new branch
2. Update the dependency
3. Commit the changes
4. Create a pull request

```yaml
name: Update Package Dependency

on:
    workflow_dispatch:
        inputs:
            package_name:
                description: 'Package name to update'
                required: true
            package_version:
                description: 'Package version to update to'
                required: true
permissions:
    contents: write
    packages: read
    id-token: write
    pull-requests: write
env:
    NODE_AUTH_TOKEN: ${{ secrets.GITHUB_TOKEN }}

jobs:
    update-dependency:
        runs-on: ubuntu-latest
        steps:
            - name: checkout repository
              uses: actions/checkout@v4

            - name: Setup Node.js
              uses: actions/setup-node@v4
              with:
                  node-version: '20.x'
                  registry-url: 'https://npm.pkg.github.com'

            - name: Configure Git
              shell: bash
              run: |
                  git config user.name "GitHub Actions"
                  git config user.email "actions@github.com"

            - name: Create branch
              shell: bash
              run: |
                  BRANCH_NAME="update-${{ github.event.inputs.package_name }}-${{ github.event.inputs.package_version }}"
                  git checkout -b $BRANCH_NAME
                  echo "BRANCH_NAME=$BRANCH_NAME" >> $GITHUB_ENV

            - name: Update dependency
              shell: bash
              run: |
                  npm install ${{ github.event.inputs.package_name }}@${{ github.event.inputs.package_version }} --save-exact

            - name: Commit changes
              shell: bash
              run: |
                  git add .
                  git commit -m "Update ${{ github.event.inputs.package_name }} to version ${{ github.event.inputs.package_version }}"
                  git push origin ${{ env.BRANCH_NAME }}
              working-directory: ./service

            - name: Create Pull Request
              shell: bash
              env:
                  GH_TOKEN: ${{ secrets.github_token }}
              run: |
                  gh pr create \
                    --title "Update ${{ github.event.inputs.package_name }} to version ${{ github.event.inputs.package_version }}" \
                    --body "Automated PR to update dependency ${{ github.event.inputs.package_name }} to version ${{ github.event.inputs.package_version }}" \
                    --base main \
                    --head ${{ env.BRANCH_NAME }}
```

This workflow is designed to be triggered externally via the `workflow_dispatch` event, which allows us to pass the package name and version as parameters. The workflow then:

1. Sets up the necessary permissions and environment
2. Checks out the repository and configures Git
3. Creates a new branch with a name that reflects the update
4. Installs the updated package using NPM
5. Commits and pushes the changes
6. Creates a pull request for the update

Note that we're using GitHub's CLI tool (`gh`) to create the pull request, which makes this process seamless. The `--save-exact` flag ensures we pin the exact version rather than using a version range.

# Trigger Downstream Updates

Now that we have a workflow to update a dependency in a single repository, we need a way to trigger this workflow across multiple repositories whenever a new package version is released. We can add the following steps to the workflow that publishes your package:

```yaml
    - name: Get package version
      id: package-version
      run: |
        echo "version=$(cat package.json | jq -r '.version')" >> $GITHUB_OUTPUT

    - name: Trigger downstream repositories
      env:
        GH_TOKEN: ${{ secrets.WORKFLOW_DISPATCH_PAT }} # Personal access token with workflow permissions
        VERSION: ${{ steps.package-version.outputs.version }}
      run: |
        # List of downstream repositories to trigger
        REPOS=(
        "github/repo"
        )

        for REPO in "${REPOS[@]}"; do
        echo "Triggering workflow in $REPO"
        curl -X POST \
            -H "Authorization: token $GH_TOKEN" \
            -H "Accept: application/vnd.github.v3+json" \
            https://api.github.com/repos/$REPO/actions/workflows/update-dependency.yml/dispatches \
            -d "{\"ref\":\"main\",\"inputs\":{\"package_name\":\"Package Name here",\"package_version\":\"$VERSION\"}}"
        done
```

This code first extracts the current package version from your `package.json` file, then triggers the update dependency workflow in each downstream repository using the GitHub API.

The key components here are:

1. Using `jq` to extract the version from `package.json`
2. Storing the downstream repository list in an array
3. Using `curl` to make API calls to trigger the workflow in each repository
4. Passing the package name and version as inputs to the workflow

Note that you'll need a Personal Access Token (PAT) with workflow permissions to trigger workflows in other repositories. This token should be stored as a secret in your repository.

# Setting Up The Environment

For this automation to work correctly, you'll need:

1. The "Update Package Dependency" workflow file in each downstream repository
2. A PAT with workflow permissions added as a secret (WORKFLOW_DISPATCH_PAT)
3. The list of downstream repositories configured in your trigger step

# Conclusion

With this GitHub Actions setup, we've automated the process of updating dependencies across multiple repositories. Now, whenever we release a new version of our package, pull requests are automatically created in all downstream repositories. This approach:

1. Reduces manual work and human error
2. Ensures consistent dependency versions across projects
3. Creates a clear audit trail through pull requests
4. Allows teams to review and test changes before merging

This pattern can be extended to handle more complex scenarios, such as running tests after updates or generating changelogs. By leveraging GitHub Actions for dependency management, we've significantly improved our development workflow.
