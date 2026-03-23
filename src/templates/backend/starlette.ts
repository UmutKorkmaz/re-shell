import { BackendTemplate } from '../types';

export const starletteTemplate: BackendTemplate = {
  id: 'starlette',
  name: 'Starlette',
  displayName: 'Starlette',
  description: 'Lightweight ASGI framework for high-performance asyncio services',
  framework: 'starlette',
  version: '0.37.2',
  language: 'python',
  tags: ['python', 'starlette', 'asgi', 'async', 'graphql'],
  port: 8000,
  dependencies: {},
  features: ['rest-api', 'websockets', 'graphql', 'session-management', 'cors', 'authentication', 'file-upload', 'docker', 'database', 'testing'],

  files: {
    'requirements.txt': `starlette==0.37.2
uvicorn[standard]==0.30.1
python-multipart==0.0.9
jinja2==3.1.4
itsdangerous==2.2.0
sqlalchemy==2.0.30
alembic==1.13.1
asyncpg==0.29.0
ariadne==0.23.0
python-jose[cryptography]==3.3.0
passlib[bcrypt]==1.7.4
python-dotenv==1.0.1
httpx==0.27.0
redis==5.0.3
aiofiles==23.2.1
`,

    'src/main.py': `from starlette.applications import Starlette
from starlette.middleware.cors import CORSMiddleware
from starlette.responses import JSONResponse
from starlette.routing import Route

async def homepage(request):
    return JSONResponse({'status': 'ok'})

async def health(request):
    return JSONResponse({'status': 'healthy'})

routes = [
    Route('/', homepage),
    Route('/health', health),
]

app = Starlette(
    debug=True,
    routes=routes,
    middleware=[
        (CORSMiddleware, {
            'allow_origins': ['*'],
            'allow_methods': ['*'],
            'allow_headers': ['*'],
        })
    ]
)
`,

    'README.md': `# Starlette Application

\`\`\`bash
pip install -r requirements.txt
uvicorn src.main:app --reload
\`\`\`

Available at http://localhost:8000
`
  },

  postInstall: [
    `echo "Setting up Starlette..."
echo "1. pip install -r requirements.txt"
echo "2. uvicorn src.main:app --reload"`
  ]
};
