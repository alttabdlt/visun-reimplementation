# Chat Animation Hub Development Guide

## Build & Run Commands
### Frontend (Next.js/TypeScript/Tailwind)
- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run lint` - Run ESLint
- `npm run start` - Start production server
- `npx tsc --noEmit` - Type check TypeScript without emitting files

### Backend (Python/Flask/Manim)
- Install requirements: `pip install -r manim-service/requirements.txt`
- Run locally: `cd manim-service && python wsgi.py`
- Specific Manim test: `cd manim-service && python tests/test_manim.py <SceneName>`
- Specific test file: `cd manim-service && python tests/<test_file>.py`
- Run tests from project root: `python manim-service/tests/<test_file>.py`
- Deploy: `cd manim-service && ./deploy.sh`

## Code Style Guidelines

### TypeScript/React/Next.js
- **Types:** Prefer interfaces for props (`interface Props {...}`) and exported types
- **Naming:** PascalCase for components/interfaces, camelCase for functions/variables
- **Imports:** External libraries first, then absolute paths, then relative imports
- **Error Handling:** Use toast notifications (`toast.error("Message")`) with descriptive messages
- **State Management:** React Query for API calls, React context for global state
- **Components:** Use Radix UI primitives with Tailwind for styling

### Python/Flask
- **Naming:** snake_case for functions/variables, PascalCase for classes
- **Error Handling:** Use specific exception types with detailed logging
- **Documentation:** Include docstrings with Args/Returns sections for all functions
- **Environment Variables:** Always provide fallbacks via os.getenv("VAR", "default")
- **Testing:** Create atomic tests that validate a single feature/function

### Supabase Functions (Deno/TypeScript)
- **Response Format:** Always use `{ success: boolean, data?: any, error?: string }`
- **Error Handling:** Return user-friendly messages with detailed server logs
- **CORS:** Include proper headers for cross-origin requests
- **Type Safety:** Use explicit TypeScript types for all parameters and returns

### Code Organization
- Next.js app dir: `visun/src/app/` 
- React components: `visun/src/components/`
- UI components: `visun/src/components/ui/`
- Python backend: `manim-service/`
- Serverless functions: `supabase/functions/`
- Tests: `manim-service/tests/`