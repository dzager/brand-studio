# Brand Studio

## Stack
Next.js + TypeScript

## Structure

src/
brand/ → brand engine logic
pages/api/ → API endpoints
public/ → assets

## Important Files

src/brand/engine.ts  
Core brand generation logic

src/pages/api/create.ts  
API route for generating blog content

## Coding Rules

- Use TypeScript types
- Avoid `any`
- Keep functions small
- Do not modify `.env.local`
- Preserve existing folder structure
- Avoid unnecessary dependencies

## Validation

After code edits run:

npx tsc --noEmit  
npm run lint  

If architecture changes:

npm run build

## Guidelines

Prefer minimal changes.  
Do not rewrite large files unless necessary.  
Explain bug fixes briefly.