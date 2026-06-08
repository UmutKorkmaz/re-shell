import fs from 'fs-extra';
import path from 'path';
import chalk from 'chalk';

/**
 * gRPC Bridge Generation
 *
 * Generate gRPC service definitions and client/server code
 * for all supported languages with automatic code generation.
 */

export interface GRPCService {
  name: string;
  version: string;
  package: string;
  service: string;
  methods: GRPCMethod[];
  messages: GRPCMessage[];
}

export interface GRPCMethod {
  name: string;
  requestType: string;
  responseType: string;
  clientStreaming: boolean;
  serverStreaming: boolean;
  description: string;
}

export interface GRPCMessage {
  name: string;
  fields: GRPCField[];
}

export interface GRPCField {
  name: string;
  type: string;
  number: number;
  repeated: boolean;
  optional: boolean;
  description: string;
}

export interface GRPCBridge {
  language: string;
  protoFile: string;
  serverCode: string;
  clientCode: string;
  dependencies: string[];
  buildInstructions: string[];
}

/**
 * Generate gRPC service definition
 */
export async function generateGRPCService(
  serviceName: string,
  methods: Array<{ name: string; request: string; response: string }>,
  projectPath: string = process.cwd()
): Promise<GRPCService> {
  const service: GRPCService = {
    name: serviceName,
    version: 'v1',
    package: toSnakeCase(serviceName),
    service: toPascalCase(serviceName) + 'Service',
    methods: methods.map((m) => ({
      name: m.name,
      requestType: m.request,
      responseType: m.response,
      clientStreaming: false,
      serverStreaming: false,
      description: `${m.name} method`,
    })),
    messages: [],
  };

  // Generate messages from methods
  for (const method of service.methods) {
    if (!service.messages.find(msg => msg.name === method.requestType)) {
      service.messages.push({
        name: method.requestType,
        fields: [
          { name: 'id', type: 'string', number: 1, repeated: false, optional: false, description: 'Unique identifier' },
          { name: 'data', type: 'string', number: 2, repeated: false, optional: true, description: 'Request data' },
        ],
      });
    }

    if (!service.messages.find(msg => msg.name === method.responseType)) {
      service.messages.push({
        name: method.responseType,
        fields: [
          { name: 'success', type: 'bool', number: 1, repeated: false, optional: false, description: 'Success status' },
          { name: 'message', type: 'string', number: 2, repeated: false, optional: true, description: 'Response message' },
          { name: 'data', type: 'string', number: 3, repeated: false, optional: true, description: 'Response data' },
        ],
      });
    }
  }

  return service;
}

/**
 * Generate .proto file
 */
export function generateProtoFile(service: GRPCService): string {
  let proto = `syntax = "proto3";

package ${service.package};

service ${service.service} {
`;

  for (const method of service.methods) {
    const requestStreaming = method.clientStreaming ? 'stream ' : '';
    const responseStreaming = method.serverStreaming ? 'stream ' : '';
    proto += `  rpc ${method.name} (${requestStreaming}${method.requestType}) returns (${responseStreaming}${method.responseType});\n`;
  }

  proto += '}\n\n';

  for (const message of service.messages) {
    proto += `message ${message.name} {\n`;

    for (const field of message.fields) {
      const repeated = field.repeated ? 'repeated ' : '';
      const optional = field.optional ? 'optional ' : '';
      proto += `  ${repeated}${optional}${field.type} ${field.name} = ${field.number}; // ${field.description}\n`;
    }

    proto += '}\n\n';
  }

  return proto;
}

/**
 * Generate gRPC bridge for language
 */
export async function generateGRPCBridge(
  service: GRPCService,
  language: string
): Promise<GRPCBridge> {
  const protoFile = generateProtoFile(service);
  let bridge: GRPCBridge;

  switch (language) {
    case 'typescript':
      bridge = generateTypeScriptGRPC(service);
      break;
    case 'python':
      bridge = generatePythonGRPC(service);
      break;
    case 'go':
      bridge = generateGoGRPC(service);
      break;
    case 'csharp':
      bridge = generateCSharpGRPC(service);
      break;
    default:
      bridge = generateGenericGRPC(service, language);
  }

  bridge.protoFile = protoFile;

  return bridge;
}

/**
 * Generate TypeScript gRPC bridge
 */
function generateTypeScriptGRPC(service: GRPCService): GRPCBridge {
  return {
    language: 'typescript',
    protoFile: '',
    serverCode: generateTypeScriptGRPCServer(service),
    clientCode: generateTypeScriptGRPCClient(service),
    dependencies: [
      '@grpc/grpc-js',
      '@grpc/proto-loader',
      'google-protobuf',
    ],
    buildInstructions: [
      'npm install @grpc/grpc-js @grpc/proto-loader google-protobuf',
      'Place .proto file in src/proto directory',
      'Compile with: protoc --ts_out=src/proto src/proto/*.proto',
    ],
  };
}

function generateTypeScriptGRPCServer(service: GRPCService): string {
  return `import * as grpc from '@grpc/grpc-js';
import * as protoLoader from '@grpc/proto-loader';

const PROTO_PATH = path.join(__dirname, 'proto', '${service.name}.proto');

const packageDefinition = protoLoader.loadSync(PROTO_PATH, {
  keepCase: true,
  longs: String,
  enums: String,
  defaults: true,
  oneofs: true,
});

const ${toCamelCase(service.package)} = grpc.loadPackageDefinition(packageDefinition).${service.package};

export class ${toPascalCase(service.name)}Server {
  private server: grpc.Server;

  constructor() {
    this.server = new grpc.Server();
  }

  start(): void {
    this.server.bindAsync(
      '0.0.0.0:50051',
      grpc.ServerCredentials.createInsecure(),
      () => {
        console.log('${toPascalCase(service.name)} server running on port 50051');
        this.server.start();
      }
    );
  }

  async ${toCamelCase(service.name)}(
    call: ServerUnaryCall<any, any>,
    callback: sendUnaryData<any>
  ): Promise<void> {
    try {
      // TODO: Implement ${toCamelCase(service.name)} logic
      callback(null, { success: true, message: 'OK' });
    } catch (error) {
      callback(error as Error);
    }
  }

  getService(): grpc.Server {
    return this.server;
  }
}
`;
}

function generateTypeScriptGRPCClient(service: GRPCService): string {
  return `import * as grpc from '@grpc/grpc-js';
import * as protoLoader from '@grpc/proto-loader';

const PROTO_PATH = path.join(__dirname, 'proto', '${service.name}.proto');

const packageDefinition = protoLoader.loadSync(PROTO_PATH, {
  keepCase: true,
  longs: String,
  enums: String,
  defaults: true,
  oneofs: true,
});

const ${toCamelCase(service.package)} = grpc.loadPackageDefinition(packageDefinition).${service.package};

export class ${toPascalCase(service.name)}Client {
  private client: any;

  constructor(serverAddress: string = 'localhost:50051') {
    this.client = new ${toPascalCase(service.package)}.${service.service}(
      serverAddress,
      grpc.credentials.createInsecure()
    );
  }

  async ${toCamelCase(service.name)}(request: any): Promise<any> {
    return new Promise((resolve, reject) => {
      this.client.${toCamelCase(service.name)}(request, (error: Error, response: any) => {
        if (error) {
          reject(error);
        } else {
          resolve(response);
        }
      });
    });
  }
}
`;
}

/**
 * Generate Python gRPC bridge
 */
function generatePythonGRPC(service: GRPCService): GRPCBridge {
  return {
    language: 'python',
    protoFile: '',
    serverCode: generatePythonGRPCServer(service),
    clientCode: generatePythonGRPCClient(service),
    dependencies: [
      'grpcio',
      'grpcio-tools',
      'protobuf',
    ],
    buildInstructions: [
      'pip install grpcio grpcio-tools protobuf',
      'Generate code: python -m grpc_tools.protoc -I. --python_out=. --grpc_python_out=. ${service.name}.proto',
    ],
  };
}

function generatePythonGRPCServer(service: GRPCService): string {
  return `import grpc
from concurrent import futures
import ${service.name}_pb2
import ${service.name}_pb2_grpc

class ${toPascalCase(service.name)}Servicer(${service.name}_pb2_grpc.${toPascalCase(service.name)}Servicer):
    def __init__(self):
        pass

    async def ${toCamelCase(service.name)}(
        self, request: ${service.name}_pb2.${toPascalCase(service.methods[0].requestType)},
        context: grpc.ServicerContext
    ) -> ${service.name}_pb2.${toPascalCase(service.methods[0].responseType)}:
        # TODO: Implement ${toCamelCase(service.name)} logic
        return ${service.name}_pb2.${toPascalCase(service.methods[0].responseType)}(
            success=True,
            message='OK'
        )

def serve():
    server = grpc.server(futures.ThreadPoolExecutor(max_workers=10))
    ${service.name}_pb2_grpc.add_${toCamelCase(service.name)}Servicer_to_server(
        ${toPascalCase(service.name)}Servicer(), server
    )
    server.add_insecure_port('[::]:50051')
    server.start()
    print('Server started on port 50051')
    server.wait_for_termination()

if __name__ == '__main__':
    serve()
`;
}

function generatePythonGRPCClient(service: GRPCService): string {
  return `import grpc
import ${service.name}_pb2
import ${service.name}_pb2_grpc

class ${toPascalCase(service.name)}Client:
    def __init__(self, host: str = 'localhost:50051'):
        self.channel = grpc.insecure_channel(host)
        self.stub = ${service.name}_pb2_grpc.${toPascalCase(service.name)}Stub(self.channel)

    async def ${toCamelCase(service.name)}(self, request) -> dict:
        response = self.stub.${toCamelCase(service.name)}(request)
        return {
            'success': response.success,
            'message': response.message,
            'data': response.data if response.HasField('data') else None
        }
`;
}

/**
 * Generate Go gRPC bridge
 */
function generateGoGRPC(service: GRPCService): GRPCBridge {
  return {
    language: 'go',
    protoFile: '',
    serverCode: generateGoGRPCServer(service),
    clientCode: generateGoGRPCClient(service),
    dependencies: [
      'google.golang.org/grpc',
      'google.golang.org/protobuf',
    ],
    buildInstructions: [
      'go get google.golang.org/grpc',
      'go get google.golang.org/protobuf',
      'Generate code: protoc --go_out=. --go_opt=paths=source_relative --go-grpc_out=. --go-grpc_opt=paths=source_relative ${service.name}.proto',
    ],
  };
}

function generateGoGRPCServer(service: GRPCService): string {
  return `package main

import (
	"context"
	"log"
	"net"

	"google.golang.org/grpc"
	pb "${toSnakeCase(service.name)}"
)

type server struct {
	pb.Unimplemented${toPascalCase(service.service)}Server
}

func (s *server) ${toPascalCase(service.methods[0].name)}(
	ctx context.Context,
	in *pb.${toPascalCase(service.methods[0].requestType)},
) (*pb.${toPascalCase(service.methods[0].responseType)}, error) {
	// TODO: Implement ${toCamelCase(service.methods[0].name)} logic
	return &pb.${toPascalCase(service.methods[0].responseType)}{
		Success: true,
		Message:  "OK",
	}, nil
}

func main() {
	lis, err := net.Listen("tcp", ":50051")
	if err != nil {
		log.Fatalf("Failed to listen: %v", err)
	}

	s := grpc.NewServer()
	pb.Register${toPascalCase(service.service)}Server(s, &server{})

	log.Println("Server started on port 50051")
	if err := s.Serve(lis); err != nil {
		log.Fatalf("Failed to serve: %v", err)
	}
}
`;
}

function generateGoGRPCClient(service: GRPCService): string {
  return `package main

import (
	"context"
	"log"

	"google.golang.org/grpc"
	pb "${toSnakeCase(service.name)}"
)

type ${toPascalCase(service.name)}Client struct {
	client pb.${toPascalCase(service.service)}Client
}

func New${toPascalCase(service.name)}Client(addr string) *${toPascalCase(service.name)}Client {
	conn, err := grpc.Dial(addr, grpc.WithInsecure())
	if err != nil {
		log.Fatalf("Failed to connect: %v", err)
	}

	return &${toPascalCase(service.name)}Client{
		client: pb.New${toPascalCase(service.service)}Client(conn),
	}
}

func (c *${toPascalCase(service.name)}Client) ${toPascalCase(service.methods[0].name)}(
	ctx context.Context,
	req *pb.${toPascalCase(service.methods[0].requestType)},
) (*pb.${toPascalCase(service.methods[0].responseType)}, error) {
	return c.client.${toPascalCase(service.methods[0].name)}(ctx, req)
}
`;
}

/**
 * Generate C# gRPC bridge
 */
function generateCSharpGRPC(service: GRPCService): GRPCBridge {
  return {
    language: 'csharp',
    protoFile: '',
    serverCode: generateCSharpGRPCServer(service),
    clientCode: generateCSharpGRPCClient(service),
    dependencies: [
      'Grpc.Core',
      'Grpc.Tools',
      'Google.Protobuf',
    ],
    buildInstructions: [
      'dotnet add package Grpc.Core Grpc.Tools Google.Protobuf',
      'Add <Protobuf /> item to .csproj',
      'Build with: dotnet build',
    ],
  };
}

function generateCSharpGRPCServer(service: GRPCService): string {
  return `using Grpc.Core;
using Grpc.Core.Server;
using ${service.package};

public class ${toPascalCase(service.name)}Server : ${toPascalCase(service.service)}.${toPascalCase(service.service)}Base
{
    public override Task<${toPascalCase(service.methods[0].responseType)}> ${toPascalCase(service.methods[0].name)}(
        ${toPascalCase(service.methods[0].requestType)} request,
        ServerCallContext context)
    {
        // TODO: Implement ${toCamelCase(service.methods[0].name)} logic
        return Task.FromResult(new ${toPascalCase(service.methods[0].responseType)} {
            Success = true,
            Message = "OK"
        });
    }

    public void Start()
    {
        const int port = 50051;
        Server server = new Server
        {
            Ports = { new ServerPort("localhost", port, ServerCredentials.Insecure) }
        };

        ${toPascalCase(service.service)}.BindService(server, this);
        server.Start();

        Console.WriteLine($"Server started on port {port}");
        server.Wait();
    }
}
`;
}

function generateCSharpGRPCClient(service: GRPCService): string {
  const clientClassName = toPascalCase(service.name) + 'Client';
  const servicePascal = toPascalCase(service.service);
  const packageNamespace = service.package;
  const methodName = service.methods[0].name;
  const methodAsync = methodName + 'Async';
  const requestType = service.methods[0].requestType;
  const responseType = service.methods[0].responseType;

  return `using Grpc.Net.Client;
using ${packageNamespace};

public class ${clientClassName}
{
    private readonly ${servicePascal}.${servicePascal}Client client;

    public ${clientClassName}(string address = "localhost:50051")
    {
        var channel = GrpcChannel.ForAddress(address);
        client = new ${servicePascal}.${servicePascal}Client(channel);
    }

    public async Task<${responseType}> ${methodAsync}(
        ${requestType} request,
        CallOptions? options = null)
    {
        return await client.${methodAsync}(request, options);
    }
}
`;
}

/**
 * Generate generic gRPC bridge
 */
function generateGenericGRPC(service: GRPCService, language: string): GRPCBridge {
  return {
    language,
    protoFile: generateProtoFile(service),
    serverCode: `// TODO: Implement gRPC server for ${language}`,
    clientCode: `// TODO: Implement gRPC client for ${language}`,
    dependencies: [],
    buildInstructions: [
      `Install gRPC tools for ${language}`,
      `Compile ${service.name}.proto with appropriate plugin`,
    ],
  };
}

/**
 * Helper functions
 */
function toPascalCase(str: string): string {
  return str.replace(/(\w)(\w*)/g, (g0, g1, g2) => g1.toUpperCase() + g2.toLowerCase());
}

function toCamelCase(str: string): string {
  return str.charAt(0).toLowerCase() + str.slice(1);
}

function toSnakeCase(str: string): string {
  return str.charAt(0).toLowerCase() + str.slice(1).replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
}

/**
 * Write gRPC files
 */
export async function writeGRPCFiles(
  serviceName: string,
  protoFile: string,
  bridge: GRPCBridge,
  outputPath: string
): Promise<void> {
  const protoDir = path.join(outputPath, 'proto');
  await fs.ensureDir(protoDir);
  await fs.writeFile(path.join(protoDir, `${serviceName}.proto`), protoFile);

  if (bridge.serverCode) {
    const serverFile = path.join(outputPath, `${serviceName}-server.${getFileExtension(bridge.language)}`);
    await fs.writeFile(serverFile, bridge.serverCode);
  }

  if (bridge.clientCode) {
    const clientFile = path.join(outputPath, `${serviceName}-client.${getFileExtension(bridge.language)}`);
    await fs.writeFile(clientFile, bridge.clientCode);
  }

  // Write build instructions
  const readmeFile = path.join(outputPath, 'BUILD.md');
  const readmeContent = generateBuildREADME(serviceName, bridge);
  await fs.writeFile(readmeFile, readmeContent);
}

function getFileExtension(language: string): string {
  const extensions: Record<string, string> = {
    typescript: 'ts',
    python: 'py',
    go: 'go',
    csharp: 'cs',
  };
  return extensions[language] || 'txt';
}

function generateBuildREADME(serviceName: string, bridge: GRPCBridge): string {
  return `# gRPC Build Instructions for ${serviceName}

## Language: ${bridge.language.toUpperCase()}

## Dependencies

\`\`\`bash
${bridge.dependencies.map(dep => getInstallCommand(dep, bridge.language)).join('\n')}
\`\`\`

## Build Steps

${bridge.buildInstructions.map((step, i) => `${i + 1}. ${step}`).join('\n')}

## Usage

### Server
\`\`\`bash
node ${serviceName}-server.${getFileExtension(bridge.language)}
\`\`\`

### Client
\`\`\`bash
node ${serviceName}-client.${getFileExtension(bridge.language)}
\`\`\`

## Proto File

The proto file is located in \`proto/${serviceName}.proto\`.

## Generated Files

After following the build steps, you should have generated files:
- Generated protobuf classes
- Generated gRPC server/base classes
- Generated gRPC client stubs
`;
}

function getInstallCommand(dep: string, language: string): string {
  const commands: Record<string, (dep: string) => string> = {
    typescript: (dep) => `npm install ${dep}`,
    python: (dep) => `pip install ${dep}`,
    go: (dep) => `go get ${dep}`,
    csharp: (dep) => `dotnet add package ${dep}`,
  };

  const fn = commands[language];
  return fn ? fn(dep) : `# Install ${dep} for ${language}`;
}

/**
 * Display gRPC service info
 */
export async function displayGRPCService(service: GRPCService): Promise<void> {
  console.log(chalk.bold(`\n🔗 gRPC Service: ${service.name}\n`));
  console.log(chalk.cyan(`Version: ${service.version}`));
  console.log(chalk.cyan(`Package: ${service.package}`));
  console.log(chalk.cyan(`Service: ${service.service}\n`));

  console.log(chalk.bold('Methods:\n'));

  for (const method of service.methods) {
    const streaming = method.clientStreaming ? 'client streaming' : method.serverStreaming ? 'server streaming' : '';
    console.log(`  ${chalk.green('✓')} ${method.name}`);
    console.log(chalk.gray(`      Request: ${method.requestType}`));
    console.log(chalk.gray(`      Response: ${method.responseType}`));
    if (streaming) {
      console.log(chalk.yellow(`      ${streaming}`));
    }
    console.log('');
  }

  console.log(chalk.bold('Messages:\n'));

  for (const message of service.messages) {
    console.log(chalk.cyan(`message ${message.name} {`));
    for (const field of message.fields) {
      const modifiers = [
        field.repeated ? 'repeated' : '',
        field.optional ? 'optional' : '',
      ].filter(Boolean).join(' ');

      console.log(`  ${modifiers.padEnd(12)} ${field.type.padEnd(20)} ${field.name} = ${field.number}; // ${field.description}`);
    }
    console.log(chalk.cyan('}\n'));
  }
}
