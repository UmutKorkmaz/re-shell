import * as React from 'react';
import { DEFAULT_WHITE_LABEL, type ResolvedWhiteLabel } from '@re-shell/contracts';
import { applyBrand, readBrand } from './brand';

const BrandContext = React.createContext<ResolvedWhiteLabel>(DEFAULT_WHITE_LABEL);

/**
 * Provides the white-label brand to the shell. The brand is read once from the page (it is fixed at
 * build / serve time) and its accent + favicon are applied on mount. `brand` can be supplied
 * directly (tests, Storybook-style embedding).
 */
export function BrandProvider({
  brand,
  children,
}: {
  brand?: ResolvedWhiteLabel;
  children: React.ReactNode;
}): React.ReactElement {
  const resolved = React.useMemo(() => brand ?? readBrand(), [brand]);
  React.useEffect(() => {
    applyBrand(resolved);
  }, [resolved]);
  return <BrandContext.Provider value={resolved}>{children}</BrandContext.Provider>;
}

/** The active white-label brand (defaults when none is configured). */
export function useBrand(): ResolvedWhiteLabel {
  return React.useContext(BrandContext);
}
