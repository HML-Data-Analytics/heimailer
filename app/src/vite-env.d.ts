/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Azure AD app registration — Application (client) ID. Set in Vercel env. */
  readonly VITE_AZURE_CLIENT_ID?: string;
  /** Azure AD Directory (tenant) ID, or "common" / "organizations". */
  readonly VITE_AZURE_TENANT_ID?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
