# Public deployment boundary

Vercel publishes only `public-dist`, built from `scripts/public-files.json`. The repository root is never a static output directory. Serverless handlers remain under `api/`.

To add a public asset, review its contents, add its exact path to the manifest, and run `node scripts/build-public.mjs` followed by `node tests/deployment-boundary.mjs`. Do not add private or client folders. The builder rejects private path segments, traversal and symlinks. New files are excluded until deliberately listed.

Client documents and database snapshots belong in access-controlled storage outside this public repository. Deployment exclusions do not protect Git history. Before removal, preserve originals and verify hashes. Historical cleanup requires a separate approved plan covering all refs, pull requests, caches and forks. Never roll production back to a root-output deployment.
