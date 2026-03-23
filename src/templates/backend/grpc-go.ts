import { BackendTemplate } from '../types';

export const grpcGoTemplate: BackendTemplate = {
  id: 'grpc-go',
  name: 'grpc-go',
  displayName: 'gRPC Go Service',
  description: 'High-performance gRPC Go service with Protocol Buffers, streaming, and interceptors',
  language: 'go',
  framework: 'grpc-go',
  version: '1.0.0',
  tags: ['go', 'grpc', 'protobuf', 'microservice', 'api', 'streaming'],
  port: 50051,
  dependencies: {},
  features: ['logging', 'monitoring', 'testing', 'security', 'grpc', 'streaming'],

  files: {
    // Go module
    'go.mod': `module github.com/example/{{projectName}}

go 1.21

require (
	google.golang.org/grpc v1.60.0
	google.golang.org/protobuf v1.32.0
	go.uber.org/zap v1.27.0
	github.com/grpc-ecosystem/go-grpc-middleware v1.4.0
)
`,

    // Protobuf definitions
    'protos/service.proto': `syntax = "proto3";

package {{projectName}};
option go_package = "github.com/example/{{projectName}}/pb";

import "google/protobuf/timestamp.proto";
import "google/protobuf/empty.proto";

// User service
service UserService {
  rpc GetUser (GetUserRequest) returns (UserReply);
  rpc CreateUser (CreateUserRequest) returns (UserReply);
  rpc UpdateUser (UpdateUserRequest) returns (UserReply);
  rpc DeleteUser (DeleteUserRequest) returns (google.protobuf.Empty);
  rpc ListUsers (google.protobuf.Empty) returns (ListUsersReply);
  
  // Server streaming
  rpc WatchUsers (WatchUsersRequest) returns (stream UserReply);
  
  // Client streaming
  rpc BatchCreateUsers (stream CreateUserRequest) returns (BatchCreateUsersReply);
}

message GetUserRequest {
  int64 id = 1;
}

message UserReply {
  int64 id = 1;
  string email = 2;
  string name = 3;
  google.protobuf.Timestamp created_at = 4;
}

message CreateUserRequest {
  string email = 1;
  string name = 2;
  string password = 3;
}

message UpdateUserRequest {
  int64 id = 1;
  string name = 2;
  string email = 3;
}

message DeleteUserRequest {
  int64 id = 1;
}

message ListUsersReply {
  repeated UserReply users = 1;
}

message WatchUsersRequest {
  int64 last_id = 1;
}

message BatchCreateUsersReply {
  int32 count = 1;
  repeated UserReply users = 2;
}
`,

    // Main server
    'main.go': `package main

import (
	"context"
	"fmt"
	"log"
	"net"
	"sync"
	"time"

	pb "github.com/example/{{projectName}}/pb"
	"go.uber.org/zap"
	"google.golang.org/grpc"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/reflection"
	"google.golang.org/grpc/status"
	"google.golang.org/protobuf/types/known/emptypb"
	"google.golang.org/protobuf/types/known/timestamppb"
)

type server struct {
	pb.UnimplementedUserServiceServer
	mu    sync.RWMutex
	users map[int64]*pb.UserReply
	nextID int64
	logger *zap.Logger
}

func newServer(logger *zap.Logger) *server {
	return &server{
		users:  make(map[int64]*pb.UserReply),
		nextID: 1,
		logger: logger,
	}
}

func (s *server) GetUser(ctx context.Context, req *pb.GetUserRequest) (*pb.UserReply, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	user, ok := s.users[req.Id]
	if !ok {
		return nil, status.Errorf(codes.NotFound, "user not found")
	}
	return user, nil
}

func (s *server) CreateUser(ctx context.Context, req *pb.CreateUserRequest) (*pb.UserReply, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	user := &pb.UserReply{
		Id:        s.nextID,
		Email:     req.Email,
		Name:      req.Name,
		CreatedAt: timestamppb.Now(),
	}
	s.users[s.nextID] = user
	s.nextID++

	s.logger.Info("User created", zap.Int64("id", user.Id))
	return user, nil
}

func (s *server) UpdateUser(ctx context.Context, req *pb.UpdateUserRequest) (*pb.UserReply, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	user, ok := s.users[req.Id]
	if !ok {
		return nil, status.Errorf(codes.NotFound, "user not found")
	}

	if req.Name != "" {
		user.Name = req.Name
	}
	if req.Email != "" {
		user.Email = req.Email
	}

	return user, nil
}

func (s *server) DeleteUser(ctx context.Context, req *pb.DeleteUserRequest) (*emptypb.Empty, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	if _, ok := s.users[req.Id]; !ok {
		return nil, status.Errorf(codes.NotFound, "user not found")
	}

	delete(s.users, req.Id)
	return &emptypb.Empty{}, nil
}

func (s *server) ListUsers(ctx context.Context, req *emptypb.Empty) (*pb.ListUsersReply, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	users := make([]*pb.UserReply, 0, len(s.users))
	for _, user := range s.users {
		users = append(users, user)
	}

	return &pb.ListUsersReply{Users: users}, nil
}

func (s *server) WatchUsers(req *pb.WatchUsersRequest, stream pb.UserService_WatchUsersServer) error {
	s.mu.RLock()
	users := make([]*pb.UserReply, 0, len(s.users))
	for _, user := range s.users {
		if user.Id > req.LastId {
			users = append(users, user)
		}
	}
	s.mu.RUnlock()

	for _, user := range users {
		if err := stream.Send(user); err != nil {
			return err
		}
	}

	return nil
}

func (s *server) BatchCreateUsers(stream pb.UserService_BatchCreateUsersServer) error {
	var users []*pb.UserReply
	var count int32

	for {
		req, err := stream.Recv()
		if err == io.EOF {
			break
		}
		if err != nil {
			return err
		}

		s.mu.Lock()
		user := &pb.UserReply{
			Id:        s.nextID,
			Email:     req.Email,
			Name:      req.Name,
			CreatedAt: timestamppb.Now(),
		}
		s.users[s.nextID] = user
		s.nextID++
		s.mu.Unlock()

		users = append(users, user)
		count++
	}

	return stream.SendAndClose(&pb.BatchCreateUsersReply{
		Count: count,
		Users: users,
	})
}

func loggingInterceptor(logger *zap.Logger) grpc.UnaryServerInterceptor {
	return func(ctx context.Context, req interface{}, info *grpc.UnaryServerInfo, handler grpc.UnaryHandler) (interface{}, error) {
		start := time.Now()
		logger.Info("gRPC call", zap.String("method", info.FullMethod))

		resp, err := handler(ctx, req)
		logger.Info("gRPC call completed",
			zap.String("method", info.FullMethod),
			zap.Duration("duration", time.Since(start)),
		)

		return resp, err
	}
}

func main() {
	logger, err := zap.NewProduction()
	if err != nil {
		log.Fatalf("failed to create logger: %v", err)
	}
	defer logger.Sync()

	lis, err := net.Listen("tcp", ":50051")
	if err != nil {
		logger.Fatal("failed to listen", zap.Error(err))
	}

	s := grpc.NewServer(
		grpc.ChainUnaryInterceptor(loggingInterceptor(logger)),
	)

	pb.RegisterUserServiceServer(s, newServer(logger))
	reflection.Register(s)

	logger.Info("gRPC server started on :50051")

	if err := s.Serve(lis); err != nil {
		logger.Fatal("failed to serve", zap.Error(err))
	}
}
`,

    // Makefile
    'Makefile': `.PHONY: proto build run test clean

proto:
	protoc --go_out=. --go_opt=paths=source_relative \\
		--go-grpc_out=. --go-grpc_opt=paths=source_relative \\
		protos/*.proto

build: proto
	go build -o bin/server main.go

run: build
	./bin/server

test:
	go test -v ./...

clean:
	rm -rf bin/ pb/*.pb.go
`,

    // README
    'README.md': `# {{projectName}}

High-performance gRPC service in Go with Protocol Buffers.

## Quick Start

\`\`\`bash
# Generate protobuf files
make proto

# Run server
make run
\`\`\`

## Features

- gRPC with Protocol Buffers
- Unary, server streaming, and client streaming RPCs
- Logging interceptor
- Reflection for debugging

## License

MIT
`
  }
};
