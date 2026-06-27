# Replace `jardiyn-final` in GitHub Codespaces

This package is a complete rebuild of the `jardiyn-final` folder.

## Safe workflow

From the repo root in GitHub Codespaces:

```bash
git checkout -b jardiyn-10of10-rebuild
cp -r jardiyn-final jardiyn-final.backup.$(date +%Y%m%d-%H%M%S)
```

Upload/unzip this package in the repo root, then replace the app folder with the package contents.

If the uploaded folder is named `jardiyn-10of10-rebuild`, run:

```bash
rsync -av --delete jardiyn-10of10-rebuild/jardiyn-final/ ./jardiyn-final/
cd jardiyn-final
npm install
npm test
npm start
```

Open the forwarded port.

Test:

```text
/api/health
/api/tools
/api/sources
/?debug=true
```

## Commit and Render auto-deploy

If Render watches `main`:

```bash
cd /workspaces/fluffy-lamp
git status
git add jardiyn-final
git commit -m "Rebuild JarDIYn final MVP for product-grade demo"
git checkout main
git pull origin main
git merge jardiyn-10of10-rebuild
git push origin main
```

Render should auto-deploy from the connected branch.
