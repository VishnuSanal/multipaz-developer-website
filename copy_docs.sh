MULTIPAZ_REPO="multipaz-repo"
EXTRAS_REPO="extras-repo"
DOCUSAURUS_REPO="docusaurus-repo"

# KDoc copying is gated on BUILD_KDOCS (set by CI). When CI disables
# KDoc generation for faster builds, the copy is skipped entirely.
if [ "$BUILD_KDOCS" != "false" ]; then
  if [ ! -d "$MULTIPAZ_REPO/build/dokka/html" ]; then
    echo "ERROR: Multipaz KDocs not found at $MULTIPAZ_REPO/build/dokka/html" >&2
    exit 1
  fi
  cp -R $MULTIPAZ_REPO/build/dokka/html/* $DOCUSAURUS_REPO/static/kdocs/
  echo "Multipaz KDocs copied to Docusaurus kdocs/ directory"

  if [ ! -d "$EXTRAS_REPO/build/dokka/html" ]; then
    echo "ERROR: Multipaz Extras KDocs not found at $EXTRAS_REPO/build/dokka/html" >&2
    exit 1
  fi
  cp -R $EXTRAS_REPO/build/dokka/html/* $DOCUSAURUS_REPO/static/kdocs-extras/
  echo "Multipaz Extras KDocs copied to Docusaurus kdocs-extras/ directory"
else
  echo "Skipping KDocs copy (BUILD_KDOCS=false)"
fi

cp $MULTIPAZ_REPO/CHANGELOG.md                $DOCUSAURUS_REPO/changelog/0-changelog.md

cp $MULTIPAZ_REPO/CONTRIBUTING.md             $DOCUSAURUS_REPO/contributing/0-contributing.md
cp $MULTIPAZ_REPO/CODE-OF-CONDUCT.md          $DOCUSAURUS_REPO/contributing/1-code-of-conduct.md
cp $MULTIPAZ_REPO/CODING-STYLE.md             $DOCUSAURUS_REPO/contributing/2-coding-style.md
cp $MULTIPAZ_REPO/DEVELOPER-ENVIRONMENT.md    $DOCUSAURUS_REPO/contributing/3-developer-environment.md
cp $MULTIPAZ_REPO/TESTING.md                  $DOCUSAURUS_REPO/contributing/4-testing.md
cp $MULTIPAZ_REPO/MAINTAINERS.md              $DOCUSAURUS_REPO/contributing/5-maintainers.md
echo "Markdown files copied successfully"

cat $MULTIPAZ_REPO/README.md >>  $DOCUSAURUS_REPO/docs/index.md
echo "README contents appended successfully"

# Replace auto links with []() links in markdown files
# https://github.com/mdx-js/mdx/issues/1049
for file in $DOCUSAURUS_REPO/contributing/*.md; do
  sed -i -E 's/<(https?:\/\/[^>]*)>/[\1](\1)/g' "$file"
done

echo "Auto links replaced successfully"