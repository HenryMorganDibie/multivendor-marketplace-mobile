import React, { type ComponentType, type ReactNode, useEffect, useState } from 'react';

type Provider = ComponentType<{ children: ReactNode }>;

export function composeProviders(providers: Provider[]): Provider {
  return providers.reduce(
    (Accumulated, Current) => {
      const ComposedProvider = ({ children }: { children: ReactNode }) => (
        <Accumulated>
          <Current>{children}</Current>
        </Accumulated>
      );
      ComposedProvider.displayName = `Composed(${Current.displayName || Current.name || 'Provider'})`;
      return ComposedProvider;
    },
    ({ children }: { children: ReactNode }) => <>{children}</>
  );
}

export function composeDeferredProviders(
  essential: Provider[],
  deferred: Provider[],
  delayMs: number = 0
): Provider {
  const Essential = composeProviders(essential);
  const Deferred = composeProviders(deferred);

  const DeferredTree = ({ children }: { children: ReactNode }) => {
    const [ready, setReady] = useState(delayMs === 0);

    useEffect(() => {
      if (ready) return;
      if (delayMs === 0) {
        setReady(true);
        return;
      }
      const id = setTimeout(() => setReady(true), delayMs);
      return () => clearTimeout(id);
    }, [ready]);

    if (!ready) {
      return <>{children}</>;
    }
    return <Deferred>{children}</Deferred>;
  };

  const Combined = ({ children }: { children: ReactNode }) => (
    <Essential>
      <DeferredTree>{children}</DeferredTree>
    </Essential>
  );
  Combined.displayName = 'ComposedDeferredProviders';
  return Combined;
}
