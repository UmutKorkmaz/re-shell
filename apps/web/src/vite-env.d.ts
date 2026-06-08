/// <reference types="vite/client" />

// Web Components type declarations
declare namespace JSX {
  interface IntrinsicElements {
    're-shell-layout': React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement> & {
      workspace?: string;
      children?: React.ReactNode;
    };
    're-shell-sidebar': React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement> & {
      children?: React.ReactNode;
    };
    're-shell-tabs': React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement> & {
      tabs?: string;
      children?: React.ReactNode;
    };
    're-shell-health': React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement> & {
      workspace?: string;
      'hub-port'?: string;
    };
    're-shell-topology': React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement> & {
      workspace?: string;
      'hub-port'?: string;
    };
    're-shell-terminal': React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement> & {
      workspace?: string;
      'hub-port'?: string;
      command?: string;
    };
  }
}
