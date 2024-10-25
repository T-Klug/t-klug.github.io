---
title: Components, Storybook, and Mocks with Vite
date: 2024-10-25
categories: [Technology, Frontend]
tags: [components, testing, mock]     # TAG names should always be lowercase
author: TJ
image: /assets/img/components-storybook.jpeg
---

# The Problem

Creating a library of shared components can be challenging, especially when dealing with complex components that rely on other libraries like React Router or custom hooks. You can package and publish the components locally and install them in another project, but that slows development. I wanted to create a developer experience where you could work on those shared components in a rendered state. A developer could focus on a single context, ensuring the component worked and looked exactly like the design without a complicated setup.

# React Storybook

If you haven't used React Storybook before, it's a robust and well-maintained library for building UI components in isolation. There is an excellent tutorial for [setting it up](https://storybook.js.org/tutorials/intro-to-storybook/react/en/get-started/). When setting up Storybook, you should also include your decorators. We use MUI and a custom theme with standard settings and component overrides to match our requirements.

```typescript
// preview.tsx
import type { Preview } from '@storybook/react';
import { createComponentTheme } from '../src/theme/create-component-theme';
import { lightBaseTheme } from '../src/theme/light-theme-base';
import { darkBaseTheme } from '../src/theme/dark-theme-base';
import { withThemeFromJSXProvider } from '@storybook/addon-themes';
import { CssBaseline, ThemeProvider } from '@mui/material';

const preview: Preview = {
    parameters: {
        controls: {
            matchers: {
                color: /(background|color)$/i,
                date: /Date$/i,
            },
        },
    },
};

export const decorators = [
    withThemeFromJSXProvider({
        themes: {
            light: createComponentTheme(lightBaseTheme),
            dark: createComponentTheme(darkBaseTheme),
        },
        defaultTheme: 'light',
        Provider: ThemeProvider,
        GlobalStyles: CssBaseline,
    }),
];
export default preview;
```

# Mock Setup

Many plugins for Storybook support mocking, but none of them met my specific needs or provided the clarity I was hoping for. Instead, I leveraged the fact that we were using Vite in combination with aliases and `@storybook/test`.

When setting up Storybook for Vite, there is a `main.ts` file where you can modify both the Storybook and Vite configurations.

```typescript
// main.ts
import type { StorybookConfig } from '@storybook/react-vite';
import path from 'path';

/**
 * Configuration for Storybook.
 *
 * The `viteConfig.resolve.alias` values below allow us to capture imports of certain modules and replace them with mocks,
 * which is useful for testing components that depend on those modules.
 */
const config: StorybookConfig = {
    framework: '@storybook/react-vite',
    stories: ['../src/**/*.mdx', '../src/**/*.stories.@(js|jsx|mjs|ts|tsx)'],
    addons: ['@storybook/addon-links', '@storybook/addon-essentials', '@storybook/addon-themes', 'storybook-addon-module-mock'],
    viteFinal: async (viteConfig) => {
        if (viteConfig.resolve) {
            viteConfig.resolve.alias = {
                ...viteConfig.resolve.alias,
                'react-router-dom': require.resolve('./mocks/react-router-dom.mock.ts'),
                '../../hooks/use-feature/useFeature': path.resolve(__dirname, './mocks/useFeature.mock.ts'),
                // ... any other aliases you wish to create
            };
        }
        return viteConfig;
    },
};

export default config;
```

We use `viteFinal` to modify `viteConfig.resolve.alias` and provide mock files for libraries or paths when rendering in Storybook. This replaces the actual library or file with the mock file.

The mock files are intentionally kept generic, allowing story writers to implement them however they see fit.

```typescript
//react-router-dom.mock.ts
import { fn } from '@storybook/test';

export const useMatches = fn().mockName('useMatches');
export const NavLink = fn().mockName('NavLink');
export const Outlet = fn().mockName('Outlet');
export const useNavigate = fn().mockName('useNavigate');
```

# Using the Mocks

Once you've set up the mocks `useFeature`, and some React Router DOM components can use mock implementations. In one of the components `<Breadcrumb/>` , we use `useMatches` from React Router DOM. MUI suggests this pattern for building breadcrumbs at the top of the page.

```typescript
import React, { ReactNode } from 'react';
import { useMatches } from 'react-router-dom';
import Breadcrumbs from '@mui/material/Breadcrumbs';
import NavigateNextIcon from '@mui/icons-material/NavigateNext';

export default function Breadcrumb(): JSX.Element {
    const matches = useMatches();
    const crumbs: ReactNode[] = [];
    for (const match of matches) {
        const { pathname, handle } = match as { pathname: string; handle: { crumb: (params: unknown) => ReactNode } | undefined };
        if (handle?.crumb) {
            crumbs.push(handle.crumb({ ...match.params, pathname }));
        }
    }

    return (
        <Breadcrumbs sx={{ mt: '1em', mb: '4rem' }} separator={<NavigateNextIcon fontSize="small" sx={(theme) => ({ color: theme.palette.info.main })} />}>
            {crumbs.map((crumb, index) => (
                <React.Fragment key={index}>{crumb}</React.Fragment>
            ))}
        </Breadcrumbs>
    );
}
```

This was a perfect case for utilizing our new mocks. We could implement `useMatches` and have it return a set of matches in our story. Here's what it looked like:

```typescript
import type { Meta, StoryObj } from '@storybook/react';
import Breadcrumb from './Breadcrumb';
import { useMatches } from '../../../.storybook/mocks/react-router-dom.mock';
import React from 'react';
import { Home } from '@mui/icons-material';
import { Crumb } from '../Crumb/Crumb';

const meta: Meta<typeof Breadcrumb> = {
    component: Breadcrumb,
};

export default meta;

type Story = StoryObj<typeof Breadcrumb>;

export const Default: Story = {
    parameters: {
        layout: 'fullscreen',
    },
    async beforeEach() {
        useMatches.mockImplementation(() => [
            {
                pathname: '/path/to/page',
                handle: {
                    crumb: () => <Crumb icon={<Home />} textComponent="Crumb1" />, 
                },
                id: '1',
                params: { path: '/path/to/page' },
                data: undefined,
            },
            {
                pathname: '/path/to/page',
                handle: {
                    crumb: () => <Crumb icon={<Home />} textComponent="Crumb2" />, 
                },
                id: '2',
                params: { path: '/path/to/page' },
                data: undefined,
            },
            {
                pathname: '/path/to/page',
                handle: {
                    crumb: () => <Crumb icon={<Home />} textComponent="Crumb3" />, 
                },
                id: '3',
                params: { path: '/path/to/page' },
                data: undefined,
            },
        ]);
    },
};
```

As you can see, we can import the mock and `useMatches.mockImplementation` allows us to pass in an array of matches. Now, we can view the component without worrying about errors from using `useMatches` within the component.

![screenshot](/assets/img/breadcrumb.png)



# Conclusion

This wraps up how we achieved mocking in complex components for React Storybook. This approach has saved us significant time, allowing us to iterate directly in our component library rather than trying to import a local package. It also allows for hot reloading, further improving the developer experience.

