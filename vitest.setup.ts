// The offline embedding service switches both provider and table name, and the
// table name is resolved at module load. An ambient value from a shell or a CI
// job would flip the suite onto that branch before any test could stub it, so
// it is cleared here; tests that want it use vi.stubEnv.
delete process.env.OFFLINE_EMBEDDINGS_BASE_URL;
