---
title: Self contained components with Apollo
date: 2024-10-24
categories: [Technology, Frontend]
tags: [microfrontends]     # TAG names should always be lowercase
---

# Delivering Truly Self-Contained React Components with Apollo

## Introduction

We’ve all been there: trying to deliver self-contained components across teams with React, only to hit stumbling blocks regarding data handling. You go through the effort to create a component, package it up, and get it ready, but then the consuming team needs to understand how to get the data to make the component work.

As a principal architect on a platform team, I wanted to solve this problem and deliver a *genuinely self-contained component*—one that a consuming team could import and use with no setup required. In this post, I'll walk through how I achieved that with thoughtful use of Apollo.

## The Challenge with Apollo

The first issue I encountered was that our Apollo configuration was becoming unwieldy—every consuming team’s Apollo setup knew about every AppSync for every service. This wouldn't do. Initially, I tried using context names to choose which link to use. Below is an example of using Apollo Link with multiple endpoints:

```typescript
const httpLinks = ApolloLink.split(
  (operation) => operation.getContext().endpoint === AuditEndpointName,
  auditLink,
  ApolloLink.split(
    (operation) => operation.getContext().endpoint === CommentEndpointName,
    commentLink,
    ApolloLink.split(
      (operation) => operation.getContext().endpoint === CompanyEndpointName,
      companyLink,
      ApolloLink.split(
        (operation) => operation.getContext().endpoint === IntegrationEndpointName,
        integrationLink,
        ApolloLink.split(
          (operation) => operation.getContext().endpoint === NotificationEndpointName,
          notificationLink,
          ApolloLink.split(
            (operation) => operation.getContext().endpoint === CompanySubscriptionEndpointName,
            companySubscriptionLink,
            auditLink,
          ),
        ),
      ),
    ),
  ),
);
```

This configuration would be complicated to maintain as we added more services and scaled. There had to be a better way!

## The Not so Better Way

My next idea was to have multiple Apollo clients without them conflicting. Unfortunately, simply nesting Apollo providers like this:

```typescript
<ApolloProvider>
  <ApolloProvider>
    ...
  </ApolloProvider>
</ApolloProvider>
```

It wouldn't work. The providers would overwrite each other’s context, leading to conflicts. There seemed to be no clean way to handle multiple links besides adding more and more conditions.

## Enter React Context

What if we created our own context instead of relying on the default ApolloProvider?

```typescript
/* eslint-disable @typescript-eslint/no-explicit-any */
import {
  ApolloCache,
  ApolloClient,
  DefaultContext,
  DocumentNode,
  LazyQueryHookOptions,
  LazyQueryResultTuple,
  MutationHookOptions,
  MutationTuple,
  OperationVariables,
  QueryHookOptions,
  QueryResult,
  SubscriptionHookOptions,
  SubscriptionResult,
  TypedDocumentNode,
} from '@apollo/client';
import { createContext, useContext } from 'react';

export const CompanySubscriptionEndpointName = 'companySubscription';

export type CompanyServiceContextType = {
  useQuery<TData = any, TVariables extends OperationVariables = OperationVariables>(
    query: DocumentNode | TypedDocumentNode<TData, TVariables>,
    options?: QueryHookOptions<TData, TVariables>,
  ): QueryResult<TData, TVariables>;
  // ... other hooks for mutation, subscription, lazy query
  companyServiceApolloClient: ApolloClient<any> | undefined;
};

export const CompanyServiceContext = createContext<CompanyServiceContextType>({
  useQuery: () => {
    throw new Error('useQuery is not implemented');
  },
  // ... other default hook implementations
  companyServiceApolloClient: undefined,
});

export function useCompanyServiceContext(): CompanyServiceContextType {
  return useContext(CompanyServiceContext);
}
```

By creating a custom `CompanyServiceContext`, we established our own provider independent of Apollo’s default provider. We could then build our context into a provider component:

```typescript
import React from 'react';
import { CompanyServiceContext, CompanyServiceContextType } from '../../hooks/use-company-service-context';
import { useConfigureApolloCompany } from '../../hooks/use-configure-apollo-company';
import { useCompanySettings } from '../../hooks/use-company-settings';
import {
  DocumentNode,
  OperationVariables,
  QueryHookOptions,
  QueryResult,
  TypedDocumentNode,
  useQuery as useQueryApollo,
  ApolloCache,
  // ... other Apollo imports
} from '@apollo/client';

export function CompanyServiceProvider({ children, devToolsEnabled }: { children: React.ReactNode; devToolsEnabled: boolean }): JSX.Element | null {
  const { companySettings } = useCompanySettings();
  const client = useConfigureApolloCompany(companySettings, devToolsEnabled);

  function useQuery<TData = any, TVariables extends OperationVariables = OperationVariables>(
    query: DocumentNode | TypedDocumentNode<TData, TVariables>,
    options?: QueryHookOptions<TData, TVariables>,
  ): QueryResult<TData, TVariables> {
    return useQueryApollo(query, { ...options, client });
  }

  const value: CompanyServiceContextType = {
    useQuery,
    // ... other hooks (useMutation, useSubscription, etc.)
    companyServiceApolloClient: client,
  };

  return (companySettings && client && <CompanyServiceContext.Provider value={value}>{children}</CompanyServiceContext.Provider>) || null;
}
```

With this provider, consuming teams could use the `<CompanyServiceProvider>` and the `useCompanyServiceContext` Hook to get a client—or any of the usual Apollo methods—without needing to know about or set up the Apollo client itself.

## Building Reusable Hooks and Components

This new setup allowed us to build encapsulated hooks that could be delivered to teams, like so:

```typescript
import { useCompanyServiceContext } from '../use-company-service-context';
import { CustomerQuery, CustomerQueryVariables } from './useCustomer.generated';
import { gql } from '@apollo/client';

export type UseCustomerResult = {
  customer: CustomerQuery['customer'] | undefined;
  error?: ApolloError;
  loading: boolean;
};

const CustomerDocument = gql`
  query customer($companyId: String!) {
    customer(companyId: $companyId) {
      createdAt
      domainName
      id
      name
      updatedAt
      socPartner {
        id
        firstName
        lastName
        email
      }
      applications
      workdayCustomerIds
      workdayCustomers {
        name
        id
      }
    }
  }
`;

export function useCustomer(companyId: string): UseCustomerResult {
  const { useQuery } = useCompanyServiceContext();
  const { data, error, loading } = useQuery<CustomerQuery, CustomerQueryVariables>(CustomerDocument, {
    variables: { companyId },
  });

  return { customer: data?.customer, error, loading };
}
```

Notice how the `useCustomer` hook calls `useCompanyServiceContext()` to get `useQuery`? The consuming team doesn't need to know any of the setup required to call that AppSync endpoint.

This leads to fully composable components. Using this hook, we can create a component that lists companies in a table, and any team can use that component without having to set up anything. It becomes an actual "drop-in" UI piece.

## Conclusion

With this approach, I could deliver React components that were truly self-contained—wrapping their own data-fetching requirements inside contexts and hooks that abstracted away the complex Apollo client configuration. The consuming teams can now focus solely on building their features without getting bogged down in GraphQL setup. If you have run into similar challenges, I hope this approach gives you some inspiration for improving the developer experience in your team.