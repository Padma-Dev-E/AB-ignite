"use client";

import { createElement, useState, type ReactNode } from "react";
import { QueryClientProvider } from "@tanstack/react-query";
import { Provider } from "react-redux";
import { SessionProvider } from "next-auth/react";
import { createQueryClient } from "../lib/query/query-client";
import { makeStore } from "../store";

export function AppProviders({ children }: { children: ReactNode }) {
  // Instance-local lazy initialization isolates SSR requests and survives rerenders.
  const [queryClient] = useState(createQueryClient);
  const [store] = useState(makeStore);

  return createElement(SessionProvider, null,
    createElement(Provider, { store, children:
      createElement(QueryClientProvider, { client: queryClient }, children),
    }),
  );
}
