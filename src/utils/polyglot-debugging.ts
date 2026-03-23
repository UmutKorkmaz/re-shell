/**
 * Polyglot Debugging for Cross-Service Breakpoints
 *
 * Generates cross-language debugging tools with:
 * - Cross-service breakpoints with distributed tracing
 * - Step-through debugging across language boundaries
 * - Variable inspection and watch expressions
 * - Remote debugging protocol support
 * - Multi-language debugger integration
 */

import chalk from 'chalk';
import path from 'path';
import fs from 'fs-extra';

export type DebuggingLanguage = 'typescript' | 'python' | 'go';

export interface DebuggingConfig {
  projectName: string;
  language: DebuggingLanguage;
  outputDir: string;
  debugPort: number;
  enableBreakpoints: boolean;
  enableStepping: boolean;
  enableVariableWatch: boolean;
}

// TypeScript Polyglot Debugging
export function generateTypeScriptDebugging(config: DebuggingConfig): string {
  return `// Auto-generated Polyglot Debugging for ${config.projectName}
// Generated at: ${new Date().toISOString()}

import { EventEmitter } from 'events';
import { Socket } from 'net';
import v8 from 'v8';

interface Breakpoint {
  id: string;
  file: string;
  line: number;
  condition?: string;
  hitCount: number;
  enabled: boolean;
}

interface DebugSession {
  sessionId: string;
  traceId: string;
  language: string;
  breakpoints: Map<string, Breakpoint>;
  callStack: CallFrame[];
  variables: Map<string, any>;
  status: 'running' | 'paused' | 'stepping';
}

interface CallFrame {
  function: string;
  file: string;
  line: number;
  variables: Record<string, any>;
}

interface StepTarget {
  traceId: string;
  service: string;
  language: string;
  file: string;
  line: number;
}

class PolyglotDebugger extends EventEmitter {
  private debugPort: number;
  private sessions: Map<string, DebugSession>;
  private currentSession: DebugSession | null;
  private enableBreakpoints: boolean;
  private enableStepping: boolean;
  private enableVariableWatch: boolean;
  private debugSocket: Socket | null;

  constructor(debugPort: number = ${config.debugPort}, enableBreakpoints = true, enableStepping = true, enableVariableWatch = true) {
    super();
    this.debugPort = debugPort;
    this.enableBreakpoints = enableBreakpoints;
    this.enableStepping = enableStepping;
    this.enableVariableWatch = enableVariableWatch;
    this.sessions = new Map();
    this.currentSession = null;
    this.debugSocket = null;
  }

  start(): void {
    this.emit('debugger-started', { port: this.debugPort });
    console.log(\`[Debugger] Listening on port \${this.debugPort}\`);
  }

  stop(): void {
    if (this.debugSocket) {
      this.debugSocket.destroy();
      this.debugSocket = null;
    }
    this.sessions.clear();
    this.currentSession = null;
    this.emit('debugger-stopped');
  }

  // Session management
  createSession(traceId: string, language: string): DebugSession {
    const sessionId = this.generateId();
    const session: DebugSession = {
      sessionId,
      traceId,
      language,
      breakpoints: new Map(),
      callStack: [],
      variables: new Map(),
      status: 'running',
    };

    this.sessions.set(sessionId, session);
    this.currentSession = session;

    this.emit('session-created', { sessionId, traceId, language });
    return session;
  }

  getSession(traceId: string): DebugSession | undefined {
    return Array.from(this.sessions.values()).find(s => s.traceId === traceId);
  }

  // Cross-service breakpoints
  setBreakpoint(file: string, line: number, condition?: string): Breakpoint {
    if (!this.enableBreakpoints) {
      throw new Error('Breakpoints are disabled');
    }

    const breakpoint: Breakpoint = {
      id: this.generateId(),
      file,
      line,
      condition,
      hitCount: 0,
      enabled: true,
    };

    if (this.currentSession) {
      this.currentSession.breakpoints.set(breakpoint.id, breakpoint);
    }

    this.emit('breakpoint-set', { breakpoint });
    return breakpoint;
  }

  removeBreakpoint(breakpointId: string): void {
    if (this.currentSession) {
      const removed = this.currentSession.breakpoints.delete(breakpointId);
      if (removed) {
        this.emit('breakpoint-removed', { breakpointId });
      }
    }
  }

  checkBreakpoint(file: string, line: number, context?: Record<string, any>): boolean {
    if (!this.currentSession || !this.enableBreakpoints) {
      return false;
    }

    for (const breakpoint of this.currentSession.breakpoints.values()) {
      if (breakpoint.file === file && breakpoint.line === line && breakpoint.enabled) {
        if (breakpoint.condition) {
          try {
            const shouldBreak = eval(breakpoint.condition);
            if (!shouldBreak) continue;
          } catch (error) {
            console.error(\`[Debugger] Error evaluating condition: \${error}\`);
            continue;
          }
        }

        breakpoint.hitCount++;
        this.pause();
        this.emit('breakpoint-hit', { breakpoint, context });
        return true;
      }
    }

    return false;
  }

  // Call stack management
  pushCallFrame(frame: CallFrame): void {
    if (this.currentSession) {
      this.currentSession.callStack.push(frame);
      this.emit('call-frame-pushed', { frame });
    }
  }

  popCallFrame(): void {
    if (this.currentSession && this.currentSession.callStack.length > 0) {
      const frame = this.currentSession.callStack.pop();
      this.emit('call-frame-popped', { frame });
    }
  }

  getCallStack(): CallFrame[] {
    return this.currentSession ? this.currentSession.callStack : [];
  }

  // Variable inspection
  setVariable(name: string, value: any): void {
    if (this.currentSession && this.enableVariableWatch) {
      this.currentSession.variables.set(name, value);
      this.emit('variable-changed', { name, value });
    }
  }

  getVariable(name: string): any {
    return this.currentSession?.variables.get(name);
  }

  getAllVariables(): Record<string, any> {
    if (!this.currentSession) {
      return {};
    }

    return Object.fromEntries(this.currentSession.variables);
  }

  // Watch expressions
  evaluateWatch(expression: string, context: Record<string, any>): any {
    try {
      const result = eval(expression);
      this.emit('watch-evaluated', { expression, result });
      return result;
    } catch (error) {
      this.emit('watch-error', { expression, error });
      return undefined;
    }
  }

  // Cross-service step-through
  pause(): void {
    if (this.currentSession) {
      this.currentSession.status = 'paused';
      this.emit('session-paused', { sessionId: this.currentSession.sessionId });
    }
  }

  resume(): void {
    if (this.currentSession) {
      this.currentSession.status = 'running';
      this.emit('session-resumed', { sessionId: this.currentSession.sessionId });
    }
  }

  stepOver(): void {
    if (!this.enableStepping || !this.currentSession) {
      return;
    }

    this.currentSession.status = 'stepping';
    this.emit('step-over', { sessionId: this.currentSession.sessionId });
  }

  stepInto(): void {
    if (!this.enableStepping || !this.currentSession) {
      return;
    }

    this.currentSession.status = 'stepping';
    this.emit('step-into', { sessionId: this.currentSession.sessionId });
  }

  stepOut(): void {
    if (!this.enableStepping || !this.currentSession) {
      return;
    }

    this.currentSession.status = 'stepping';
    this.emit('step-out', { sessionId: this.currentSession.sessionId });
  }

  // Cross-language step coordination
  async stepToLanguage(target: StepTarget): Promise<void> {
    if (!this.enableStepping) {
      throw new Error('Stepping is disabled');
    }

    const session = this.getSession(target.traceId);
    if (!session) {
      throw new Error(\`Session not found for trace ID: \${target.traceId}\`);
    }

    this.currentSession = session;
    this.pause();

    this.emit('cross-language-step', {
      from: { language: this.currentSession.language },
      to: { language: target.language, service: target.service },
      file: target.file,
      line: target.line,
    });
  }

  // Remote debugging protocol
  async connectToDebugger(host: string, port: number): Promise<void> {
    return new Promise((resolve, reject) => {
      this.debugSocket = new Socket();

      this.debugSocket.connect(port, host, () => {
        this.emit('debugger-connected', { host, port });
        resolve();
      });

      this.debugSocket.on('data', (data) => {
        this.handleDebuggerMessage(data.toString());
      });

      this.debugSocket.on('error', (error) => {
        this.emit('debugger-error', { error });
        reject(error);
      });
    });
  }

  private handleDebuggerMessage(message: string): void {
    try {
      const command = JSON.parse(message);
      this.emit('debugger-message', command);

      switch (command.type) {
        case 'pause':
          this.pause();
          break;
        case 'resume':
          this.resume();
          break;
        case 'step':
          this.stepOver();
          break;
        case 'stepInto':
          this.stepInto();
          break;
        case 'stepOut':
          this.stepOut();
          break;
        case 'setBreakpoint':
          this.setBreakpoint(command.file, command.line, command.condition);
          break;
        case 'getVariables':
          this.emit('variables-response', this.getAllVariables());
          break;
        default:
          console.warn(\`[Debugger] Unknown command: \${command.type}\`);
      }
    } catch (error) {
      console.error(\`[Debugger] Error handling message: \${error}\`);
    }
  }

  sendCommand(command: Record<string, any>): void {
    if (this.debugSocket && !this.debugSocket.destroyed) {
      this.debugSocket.write(JSON.stringify(command) + '\\n');
    }
  }

  // Serialization for cross-boundary debugging
  serializeValue(value: any): string {
    return v8.serialize(value).toString('base64');
  }

  deserializeValue(serialized: string): any {
    return v8.deserialize(Buffer.from(serialized, 'base64'));
  }

  // Utility
  private generateId(): string {
    return \`dbg-\${Date.now()}-\${Math.random().toString(36).substring(2, 15)}\`;
  }

  // State export for debugging
  exportState(): Record<string, any> {
    return {
      sessions: Array.from(this.sessions.entries()).map(([id, session]) => ({
        sessionId: id,
        traceId: session.traceId,
        language: session.language,
        breakpointCount: session.breakpoints.size,
        variableCount: session.variables.size,
        status: session.status,
      })),
      currentSessionId: this.currentSession?.sessionId,
    };
  }
}

// Export singleton instance
const debugger = new PolyglotDebugger(${config.debugPort});

export default debugger;
export { PolyglotDebugger, Breakpoint, DebugSession, CallFrame, StepTarget };
`;
}

// Python Polyglot Debugging
export function generatePythonDebugging(config: DebuggingConfig): string {
  return `# Auto-generated Polyglot Debugging for ${config.projectName}
# Generated at: ${new Date().toISOString()}

import uuid
import time
import json
import socket
import pickle
import base64
import threading
from typing import Dict, Any, Optional, List, Callable
from dataclasses import dataclass, field
from enum import Enum
from functools import wraps

class SessionStatus(Enum):
    RUNNING = "running"
    PAUSED = "paused"
    STEPPING = "stepping"

@dataclass
class Breakpoint:
    id: str
    file: str
    line: int
    condition: Optional[str] = None
    hit_count: int = 0
    enabled: bool = True

@dataclass
class CallFrame:
    function: str
    file: str
    line: int
    variables: Dict[str, Any] = field(default_factory=dict)

@dataclass
class StepTarget:
    trace_id: str
    service: str
    language: str
    file: str
    line: int

@dataclass
class DebugSession:
    session_id: str
    trace_id: str
    language: str
    breakpoints: Dict[str, Breakpoint] = field(default_factory=dict)
    call_stack: List[CallFrame] = field(default_factory=list)
    variables: Dict[str, Any] = field(default_factory=dict)
    status: SessionStatus = SessionStatus.RUNNING

class PolyglotDebugger:
    def __init__(self, debug_port: int = ${config.debugPort}, enable_breakpoints: bool = True,
                 enable_stepping: bool = True, enable_variable_watch: bool = True):
        self.debug_port = debug_port
        self.enable_breakpoints = enable_breakpoints
        self.enable_stepping = enable_stepping
        self.enable_variable_watch = enable_variable_watch
        self.sessions: Dict[str, DebugSession] = {}
        self.current_session: Optional[DebugSession] = None
        self.debug_socket: Optional[socket.socket] = None
        self.callbacks: Dict[str, List[Callable]] = {}

    def start(self):
        """Start the debugger server."""
        print(f"[Debugger] Listening on port {self.debug_port}")
        self._emit('debugger-started', {'port': self.debug_port})

    def stop(self):
        """Stop the debugger."""
        if self.debug_socket:
            self.debug_socket.close()
            self.debug_socket = None
        self.sessions.clear()
        self.current_session = None
        self._emit('debugger-stopped', {})

    def on(self, event: str, callback: Callable):
        """Register event callback."""
        if event not in self.callbacks:
            self.callbacks[event] = []
        self.callbacks[event].append(callback)

    def _emit(self, event: str, data: Dict[str, Any]):
        """Emit event to registered callbacks."""
        if event in self.callbacks:
            for callback in self.callbacks[event]:
                callback(data)

    # Session management
    def create_session(self, trace_id: str, language: str) -> DebugSession:
        """Create a new debug session."""
        session_id = self._generate_id()
        session = DebugSession(
            session_id=session_id,
            trace_id=trace_id,
            language=language,
        )
        self.sessions[session_id] = session
        self.current_session = session
        self._emit('session-created', {'sessionId': session_id, 'traceId': trace_id, 'language': language})
        return session

    def get_session(self, trace_id: str) -> Optional[DebugSession]:
        """Get session by trace ID."""
        for session in self.sessions.values():
            if session.trace_id == trace_id:
                return session
        return None

    # Cross-service breakpoints
    def set_breakpoint(self, file: str, line: int, condition: Optional[str] = None) -> Breakpoint:
        """Set a breakpoint."""
        if not self.enable_breakpoints:
            raise RuntimeError('Breakpoints are disabled')

        breakpoint = Breakpoint(
            id=self._generate_id(),
            file=file,
            line=line,
            condition=condition,
        )

        if self.current_session:
            self.current_session.breakpoints[breakpoint.id] = breakpoint

        self._emit('breakpoint-set', {'breakpoint': breakpoint})
        return breakpoint

    def remove_breakpoint(self, breakpoint_id: str) -> None:
        """Remove a breakpoint."""
        if self.current_session and breakpoint_id in self.current_session.breakpoints:
            del self.current_session.breakpoints[breakpoint_id]
            self._emit('breakpoint-removed', {'breakpointId': breakpoint_id})

    def check_breakpoint(self, file: str, line: int, context: Optional[Dict] = None) -> bool:
        """Check if breakpoint should trigger."""
        if not self.current_session or not self.enable_breakpoints:
            return False

        for breakpoint in self.current_session.breakpoints.values():
            if breakpoint.file == file and breakpoint.line == line and breakpoint.enabled:
                if breakpoint.condition:
                    try:
                        should_break = eval(breakpoint.condition, {}, context or {})
                        if not should_break:
                            continue
                    except Exception as error:
                        print(f"[Debugger] Error evaluating condition: {error}")
                        continue

                breakpoint.hit_count += 1
                self.pause()
                self._emit('breakpoint-hit', {'breakpoint': breakpoint, 'context': context})
                return True

        return False

    # Call stack management
    def push_call_frame(self, frame: CallFrame) -> None:
        """Push a call frame onto the stack."""
        if self.current_session:
            self.current_session.call_stack.append(frame)
            self._emit('call-frame-pushed', {'frame': frame})

    def pop_call_frame(self) -> Optional[CallFrame]:
        """Pop a call frame from the stack."""
        if self.current_session and self.current_session.call_stack:
            frame = self.current_session.call_stack.pop()
            self._emit('call-frame-popped', {'frame': frame})
            return frame
        return None

    def get_call_stack(self) -> List[CallFrame]:
        """Get the current call stack."""
        return self.current_session.call_stack if self.current_session else []

    # Variable inspection
    def set_variable(self, name: str, value: Any) -> None:
        """Set a variable value."""
        if self.current_session and self.enable_variable_watch:
            self.current_session.variables[name] = value
            self._emit('variable-changed', {'name': name, 'value': value})

    def get_variable(self, name: str) -> Any:
        """Get a variable value."""
        if self.current_session:
            return self.current_session.variables.get(name)
        return None

    def get_all_variables(self) -> Dict[str, Any]:
        """Get all variables."""
        if self.current_session:
            return self.current_session.variables.copy()
        return {}

    # Watch expressions
    def evaluate_watch(self, expression: str, context: Dict[str, Any]) -> Any:
        """Evaluate a watch expression."""
        try:
            result = eval(expression, {}, context)
            self._emit('watch-evaluated', {'expression': expression, 'result': result})
            return result
        except Exception as error:
            self._emit('watch-error', {'expression': expression, 'error': str(error)})
            return None

    # Cross-service step-through
    def pause(self) -> None:
        """Pause execution."""
        if self.current_session:
            self.current_session.status = SessionStatus.PAUSED
            self._emit('session-paused', {'sessionId': self.current_session.session_id})

    def resume(self) -> None:
        """Resume execution."""
        if self.current_session:
            self.current_session.status = SessionStatus.RUNNING
            self._emit('session-resumed', {'sessionId': self.current_session.session_id})

    def step_over(self) -> None:
        """Step over current line."""
        if not self.enable_stepping or not self.current_session:
            return
        self.current_session.status = SessionStatus.STEPPING
        self._emit('step-over', {'sessionId': self.current_session.session_id})

    def step_into(self) -> None:
        """Step into function call."""
        if not self.enable_stepping or not self.current_session:
            return
        self.current_session.status = SessionStatus.STEPPING
        self._emit('step-into', {'sessionId': self.current_session.session_id})

    def step_out(self) -> None:
        """Step out of current function."""
        if not self.enable_stepping or not self.current_session:
            return
        self.current_session.status = SessionStatus.STEPPING
        self._emit('step-out', {'sessionId': self.current_session.session_id})

    # Cross-language step coordination
    async def step_to_language(self, target: StepTarget) -> None:
        """Step to a different language context."""
        if not self.enable_stepping:
            raise RuntimeError('Stepping is disabled')

        session = self.get_session(target.trace_id)
        if not session:
            raise RuntimeError(f'Session not found for trace ID: {target.trace_id}')

        self.current_session = session
        self.pause()

        self._emit('cross-language-step', {
            'from': {'language': self.current_session.language},
            'to': {'language': target.language, 'service': target.service},
            'file': target.file,
            'line': target.line,
        })

    # Remote debugging protocol
    def connect_to_debugger(self, host: str, port: int) -> None:
        """Connect to remote debugger."""
        self.debug_socket = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        try:
            self.debug_socket.connect((host, port))
            self._emit('debugger-connected', {'host': host, 'port': port})

            # Start listener thread
            thread = threading.Thread(target=self._listen_to_debugger)
            thread.daemon = True
            thread.start()
        except Exception as error:
            self._emit('debugger-error', {'error': str(error)})
            raise

    def _listen_to_debugger(self):
        """Listen for messages from debugger."""
        if not self.debug_socket:
            return

        while True:
            try:
                data = self.debug_socket.recv(4096)
                if not data:
                    break
                self._handle_debugger_message(data.decode())
            except Exception as error:
                self._emit('debugger-error', {'error': str(error)})
                break

    def _handle_debugger_message(self, message: str):
        """Handle incoming debugger message."""
        try:
            command = json.loads(message)
            self._emit('debugger-message', command)

            cmd_type = command.get('type')
            if cmd_type == 'pause':
                self.pause()
            elif cmd_type == 'resume':
                self.resume()
            elif cmd_type == 'step':
                self.step_over()
            elif cmd_type == 'stepInto':
                self.step_into()
            elif cmd_type == 'stepOut':
                self.step_out()
            elif cmd_type == 'setBreakpoint':
                self.set_breakpoint(command['file'], command['line'], command.get('condition'))
            elif cmd_type == 'getVariables':
                self._emit('variables-response', self.get_all_variables())
            else:
                print(f"[Debugger] Unknown command: {cmd_type}")
        except Exception as error:
            print(f"[Debugger] Error handling message: {error}")

    def send_command(self, command: Dict[str, Any]) -> None:
        """Send command to debugger."""
        if self.debug_socket:
            try:
                message = json.dumps(command) + '\\n'
                self.debug_socket.send(message.encode())
            except Exception as error:
                print(f"[Debugger] Error sending command: {error}")

    # Serialization for cross-boundary debugging
    def serialize_value(self, value: Any) -> str:
        """Serialize value for transmission."""
        serialized = pickle.dumps(value)
        return base64.b64encode(serialized).decode()

    def deserialize_value(self, serialized: str) -> Any:
        """Deserialize value."""
        data = base64.b64decode(serialized.encode())
        return pickle.loads(data)

    # Utility
    def _generate_id(self) -> str:
        """Generate unique ID."""
        return f"dbg-{int(time.time() * 1000)}-{uuid.uuid4().hex[:12]}"

    # State export
    def export_state(self) -> Dict[str, Any]:
        """Export debugger state."""
        return {
            'sessions': [
                {
                    'sessionId': session_id,
                    'traceId': session.trace_id,
                    'language': session.language,
                    'breakpointCount': len(session.breakpoints),
                    'variableCount': len(session.variables),
                    'status': session.status.value,
                }
                for session_id, session in self.sessions.items()
            ],
            'currentSessionId': self.current_session.session_id if self.current_session else None,
        }

# Singleton instance
debugger = PolyglotDebugger(${config.debugPort})
`;
}

// Go Polyglot Debugging
export function generateGoDebugging(config: DebuggingConfig): string {
  return `// Auto-generated Polyglot Debugging for ${config.projectName}
// Generated at: ${new Date().toISOString()}

package main

import (
	"encoding/base64"
	"encoding/json"
	"fmt"
	"net"
	"strconv"
	"sync"
	"time"

	"github.com/google/uuid"
)

// Session status
type SessionStatus string

const (
	StatusRunning  SessionStatus = "running"
	StatusPaused   SessionStatus = "paused"
	StatusStepping SessionStatus = "stepping"
)

// Breakpoint represents a code breakpoint
type Breakpoint struct {
	ID         string \`json:"id"\`
	File       string \`json:"file"\`
	Line       int    \`json:"line"\`
	Condition  string \`json:"condition,omitempty"\`
	HitCount   int    \`json:"hitCount"\`
	Enabled    bool   \`json:"enabled"\`
}

// CallFrame represents a stack frame
type CallFrame struct {
	Function  string                 \`json:"function"\`
	File      string                 \`json:"file"\`
	Line      int                    \`json:"line"\`
	Variables map[string]interface{} \`json:"variables"\`
}

// StepTarget represents a cross-language step target
type StepTarget struct {
	TraceID  string \`json:"traceId"\`
	Service  string \`json:"service"\`
	Language string \`json:"language"\`
	File     string \`json:"file"\`
	Line     int    \`json:"line"\`
}

// DebugSession represents a debugging session
type DebugSession struct {
	SessionID   string                  \`json:"sessionId"\`
	TraceID     string                  \`json:"traceId"\`
	Language    string                  \`json:"language"\`
	Breakpoints map[string]*Breakpoint  \`json:"breakpoints"\`
	CallStack   []CallFrame             \`json:"callStack"\`
	Variables   map[string]interface{}  \`json:"variables"\`
	Status      SessionStatus           \`json:"status"\`
	mu          sync.RWMutex
}

// PolyglotDebugger is the main debugger
type PolyglotDebugger struct {
	debugPort          int
	enableBreakpoints  bool
	enableStepping     bool
	enableVariableWatch bool
	sessions           map[string]*DebugSession
	currentSession     *DebugSession
	debugSocket        net.Conn
	mu                 sync.RWMutex
	callbacks          map[string][]func(map[string]interface{})
}

// NewPolyglotDebugger creates a new debugger instance
func NewPolyglotDebugger(debugPort int, enableBreakpoints, enableStepping, enableVariableWatch bool) *PolyglotDebugger {
	return &PolyglotDebugger{
		debugPort:          debugPort,
		enableBreakpoints:  enableBreakpoints,
		enableStepping:     enableStepping,
		enableVariableWatch: enableVariableWatch,
		sessions:           make(map[string]*DebugSession),
		callbacks:          make(map[string][]func(map[string]interface{})),
	}
}

// Start starts the debugger
func (d *PolyglotDebugger) Start() {
	d.mu.Lock()
	defer d.mu.Unlock()
	fmt.Printf("[Debugger] Listening on port %d\\n", d.debugPort)
	d.emit("debugger-started", map[string]interface{}{"port": d.debugPort})
}

// Stop stops the debugger
func (d *PolyglotDebugger) Stop() {
	d.mu.Lock()
	defer d.mu.Unlock()

	if d.debugSocket != nil {
		d.debugSocket.Close()
		d.debugSocket = nil
	}

	d.sessions = make(map[string]*DebugSession)
	d.currentSession = nil
	d.emit("debugger-stopped", nil)
}

// On registers an event callback
func (d *PolyglotDebugger) On(event string, callback func(map[string]interface{})) {
	d.mu.Lock()
	defer d.mu.Unlock()

	d.callbacks[event] = append(d.callbacks[event], callback)
}

func (d *PolyglotDebugger) emit(event string, data map[string]interface{}) {
	d.mu.RLock()
	defer d.mu.RUnlock()

	if callbacks, ok := d.callbacks[event]; ok {
		for _, callback := range callbacks {
			go callback(data)
		}
	}
}

// CreateSession creates a new debug session
func (d *PolyglotDebugger) CreateSession(traceID, language string) *DebugSession {
	d.mu.Lock()
	defer d.mu.Unlock()

	sessionID := d.generateID()
	session := &DebugSession{
		SessionID:   sessionID,
		TraceID:     traceID,
		Language:    language,
		Breakpoints: make(map[string]*Breakpoint),
		CallStack:   make([]CallFrame, 0),
		Variables:   make(map[string]interface{}),
		Status:      StatusRunning,
	}

	d.sessions[sessionID] = session
	d.currentSession = session
	d.emit("session-created", map[string]interface{}{
		"sessionId": sessionID,
		"traceId":   traceID,
		"language":  language,
	})

	return session
}

// GetSession retrieves a session by trace ID
func (d *PolyglotDebugger) GetSession(traceID string) *DebugSession {
	d.mu.RLock()
	defer d.mu.RUnlock()

	for _, session := range d.sessions {
		if session.TraceID == traceID {
			return session
		}
	}
	return nil
}

// SetBreakpoint sets a breakpoint
func (d *PolyglotDebugger) SetBreakpoint(file string, line int, condition string) (*Breakpoint, error) {
	if !d.enableBreakpoints {
		return nil, fmt.Errorf("breakpoints are disabled")
	}

	breakpoint := &Breakpoint{
		ID:        d.generateID(),
		File:      file,
		Line:      line,
		Condition: condition,
		Enabled:   true,
	}

	d.mu.Lock()
	defer d.mu.Unlock()

	if d.currentSession != nil {
		d.currentSession.Breakpoints[breakpoint.ID] = breakpoint
	}

	d.emit("breakpoint-set", map[string]interface{}{"breakpoint": breakpoint})
	return breakpoint, nil
}

// RemoveBreakpoint removes a breakpoint
func (d *PolyglotDebugger) RemoveBreakpoint(breakpointID string) {
	d.mu.Lock()
	defer d.mu.Unlock()

	if d.currentSession != nil {
		if _, exists := d.currentSession.Breakpoints[breakpointID]; exists {
			delete(d.currentSession.Breakpoints, breakpointID)
			d.emit("breakpoint-removed", map[string]interface{}{"breakpointId": breakpointID})
		}
	}
}

// CheckBreakpoint checks if a breakpoint should trigger
func (d *PolyglotDebugger) CheckBreakpoint(file string, line int, context map[string]interface{}) bool {
	d.mu.RLock()
	defer d.mu.RUnlock()

	if d.currentSession == nil || !d.enableBreakpoints {
		return false
	}

	for _, breakpoint := range d.currentSession.Breakpoints {
		if breakpoint.File == file && breakpoint.Line == line && breakpoint.Enabled {
			// TODO: Evaluate condition if present
			breakpoint.HitCount++
			d.Pause()
			d.emit("breakpoint-hit", map[string]interface{}{
				"breakpoint": breakpoint,
				"context":    context,
			})
			return true
		}
	}

	return false
}

// PushCallFrame pushes a call frame onto the stack
func (d *PolyglotDebugger) PushCallFrame(frame CallFrame) {
	d.mu.Lock()
	defer d.mu.Unlock()

	if d.currentSession != nil {
		d.currentSession.CallStack = append(d.currentSession.CallStack, frame)
		d.emit("call-frame-pushed", map[string]interface{}{"frame": frame})
	}
}

// PopCallFrame pops a call frame from the stack
func (d *PolyglotDebugger) PopCallFrame() {
	d.mu.Lock()
	defer d.mu.Unlock()

	if d.currentSession != nil && len(d.currentSession.CallStack) > 0 {
		var frame CallFrame
		frame, d.currentSession.CallStack = d.currentSession.CallStack[len(d.currentSession.CallStack)-1], d.currentSession.CallStack[:len(d.currentSession.CallStack)-1]
		d.emit("call-frame-popped", map[string]interface{}{"frame": frame})
	}
}

// GetCallStack returns the current call stack
func (d *PolyglotDebugger) GetCallStack() []CallFrame {
	d.mu.RLock()
	defer d.mu.RUnlock()

	if d.currentSession != nil {
		return d.currentSession.CallStack
	}
	return nil
}

// SetVariable sets a variable value
func (d *PolyglotDebugger) SetVariable(name string, value interface{}) {
	d.mu.Lock()
	defer d.mu.Unlock()

	if d.currentSession != nil && d.enableVariableWatch {
		d.currentSession.Variables[name] = value
		d.emit("variable-changed", map[string]interface{}{"name": name, "value": value})
	}
}

// GetVariable gets a variable value
func (d *PolyglotDebugger) GetVariable(name string) interface{} {
	d.mu.RLock()
	defer d.mu.RUnlock()

	if d.currentSession != nil {
		return d.currentSession.Variables[name]
	}
	return nil
}

// GetAllVariables returns all variables
func (d *PolyglotDebugger) GetAllVariables() map[string]interface{} {
	d.mu.RLock()
	defer d.mu.RUnlock()

	if d.currentSession != nil {
		var result = make(map[string]interface{})
		for k, v := range d.currentSession.Variables {
			result[k] = v
		}
		return result
	}
	return nil
}

// Pause pauses execution
func (d *PolyglotDebugger) Pause() {
	d.mu.Lock()
	defer d.mu.Unlock()

	if d.currentSession != nil {
		d.currentSession.Status = StatusPaused
		d.emit("session-paused", map[string]interface{}{"sessionId": d.currentSession.SessionID})
	}
}

// Resume resumes execution
func (d *PolyglotDebugger) Resume() {
	d.mu.Lock()
	defer d.mu.Unlock()

	if d.currentSession != nil {
		d.currentSession.Status = StatusRunning
		d.emit("session-resumed", map[string]interface{}{"sessionId": d.currentSession.SessionID})
	}
}

// StepOver steps over current line
func (d *PolyglotDebugger) StepOver() {
	if !d.enableStepping {
		return
	}

	d.mu.Lock()
	defer d.mu.Unlock()

	if d.currentSession != nil {
		d.currentSession.Status = StatusStepping
		d.emit("step-over", map[string]interface{}{"sessionId": d.currentSession.SessionID})
	}
}

// StepInto steps into function call
func (d *PolyglotDebugger) StepInto() {
	if !d.enableStepping {
		return
	}

	d.mu.Lock()
	defer d.mu.Unlock()

	if d.currentSession != nil {
		d.currentSession.Status = StatusStepping
		d.emit("step-into", map[string]interface{}{"sessionId": d.currentSession.SessionID})
	}
}

// StepOut steps out of current function
func (d *PolyglotDebugger) StepOut() {
	if !d.enableStepping {
		return
	}

	d.mu.Lock()
	defer d.mu.Unlock()

	if d.currentSession != nil {
		d.currentSession.Status = StatusStepping
		d.emit("step-out", map[string]interface{}{"sessionId": d.currentSession.SessionID})
	}
}

// ConnectToDebugger connects to remote debugger
func (d *PolyglotDebugger) ConnectToDebugger(host string, port int) error {
	conn, err := net.Dial("tcp", host+":"+strconv.Itoa(port))
	if err != nil {
		d.emit("debugger-error", map[string]interface{}{"error": err.Error()})
		return err
	}

	d.debugSocket = conn
	d.emit("debugger-connected", map[string]interface{}{"host": host, "port": port})

	// Start listener
	go d.listenToDebugger()

	return nil
}

func (d *PolyglotDebugger) listenToDebugger() {
	if d.debugSocket == nil {
		return
	}

	decoder := json.NewDecoder(d.debugSocket)
	for {
		var command map[string]interface{}
		if err := decoder.Decode(&command); err != nil {
			d.emit("debugger-error", map[string]interface{}{"error": err.Error()})
			break
		}

		d.handleDebuggerCommand(command)
	}
}

func (d *PolyglotDebugger) handleDebuggerCommand(command map[string]interface{}) {
	d.emit("debugger-message", command)

	cmdType, _ := command["type"].(string)

	switch cmdType {
	case "pause":
		d.Pause()
	case "resume":
		d.Resume()
	case "step":
		d.StepOver()
	case "stepInto":
		d.StepInto()
	case "stepOut":
		d.StepOut()
	case "setBreakpoint":
		file, _ := command["file"].(string)
		line, _ := command["line"].(int)
		condition, _ := command["condition"].(string)
		d.SetBreakpoint(file, line, condition)
	case "getVariables":
		d.emit("variables-response", d.GetAllVariables())
	}
}

// SendCommand sends command to debugger
func (d *PolyglotDebugger) SendCommand(command map[string]interface{}) error {
	if d.debugSocket == nil {
		return fmt.Errorf("not connected to debugger")
	}

	data, err := json.Marshal(command)
	if err != nil {
		return err
	}

	_, err = d.debugSocket.Write(append(data, '\\n'))
	return err
}

func (d *PolyglotDebugger) generateID() string {
	return "dbg-" + strconv.FormatInt(time.Now().UnixMilli(), 10) + "-" + uuid.New().String()[:12]
}

// ExportState exports debugger state
func (d *PolyglotDebugger) ExportState() map[string]interface{} {
	d.mu.RLock()
	defer d.mu.RUnlock()

	sessions := make([]map[string]interface{}, 0)
	for id, session := range d.sessions {
		session.mu.RLock()
		sessions = append(sessions, map[string]interface{}{
			"sessionId":      id,
			"traceId":        session.TraceID,
			"language":       session.Language,
			"breakpointCount": len(session.Breakpoints),
			"variableCount":  len(session.Variables),
			"status":         string(session.Status),
		})
		session.mu.RUnlock()
	}

	currentSessionID := ""
	if d.currentSession != nil {
		currentSessionID = d.currentSession.SessionID
	}

	return map[string]interface{}{
		"sessions":          sessions,
		"currentSessionId":  currentSessionID,
	}
}

var debugger = NewPolyglotDebugger(${config.debugPort}, true, true, true)

func main() {
	debugger.Start()
	time.Sleep(30 * time.Second)
	debugger.Stop()
}
`;
}

// Display configuration
export function displayConfig(config: DebuggingConfig): void {
  console.log(chalk.cyan('\n✨ Polyglot Debugging Configuration\n'));
  console.log(chalk.gray('─'.repeat(60)));

  console.log(chalk.yellow('Project Name:'), chalk.white(config.projectName));
  console.log(chalk.yellow('Language:'), chalk.white(config.language));
  console.log(chalk.yellow('Debug Port:'), chalk.white(config.debugPort.toString()));
  console.log(chalk.yellow('Breakpoints:'), chalk.white(config.enableBreakpoints ? 'Enabled' : 'Disabled'));
  console.log(chalk.yellow('Stepping:'), chalk.white(config.enableStepping ? 'Enabled' : 'Disabled'));
  console.log(chalk.yellow('Variable Watch:'), chalk.white(config.enableVariableWatch ? 'Enabled' : 'Disabled'));

  console.log(chalk.gray('─'.repeat(60)));
  console.log(chalk.cyan('\n🎯 Features:\n'));

  const features = [
    'Cross-service breakpoints with distributed tracing',
    'Step-through debugging across language boundaries',
    'Variable inspection and watch expressions',
    'Remote debugging protocol support',
    'Multi-language debugger integration',
    'Call stack management',
  ];

  features.slice(0, 5).forEach((feature, index) => {
    console.log('  ' + chalk.green('✓') + ' ' + chalk.white(feature));
  });

  if (features.length > 5) {
    console.log('  ' + chalk.gray('... and ' + (features.length - 5) + ' more'));
  }

  console.log(chalk.gray('\n' + '─'.repeat(60) + '\n'));
}

// Generate BUILD.md
export function generateBuildMD(config: DebuggingConfig): string {
  let content = '# Polyglot Debugging for ' + config.projectName + '\n\n';
  content += 'Cross-language debugging tools with breakpoints and step-through for **' + config.projectName + '**.\n\n';

  content += '## 📋 Configuration\n\n';
  content += '- **Project**: ' + config.projectName + '\n';
  content += '- **Language**: ' + config.language + '\n';
  content += '- **Debug Port**: ' + config.debugPort + '\n';
  content += '- **Breakpoints**: ' + (config.enableBreakpoints ? 'Enabled' : 'Disabled') + '\n';
  content += '- **Stepping**: ' + (config.enableStepping ? 'Enabled' : 'Disabled') + '\n';
  content += '- **Variable Watch**: ' + (config.enableVariableWatch ? 'Enabled' : 'Disabled') + '\n\n';

  content += '## 🚀 Installation\n\n';

  if (config.language === 'typescript') {
    content += '```bash\n';
    content += 'npm install\n';
    content += '```\n\n';
  } else if (config.language === 'python') {
    content += '```bash\n';
    content += 'pip install -r requirements.txt\n';
    content += '```\n\n';
  } else if (config.language === 'go') {
    content += '```bash\n';
    content += 'go mod tidy\n';
    content += '```\n\n';
  }

  content += '## 💻 Usage\n\n';

  if (config.language === 'typescript') {
    content += '```typescript\n';
    content += 'import debugger from \'./polyglot-debugging\';\n\n';
    content += '// Start debugger\n';
    content += 'debugger.start();\n\n';
    content += '// Create session\n';
    content += 'const session = debugger.createSession(\'trace-123\', \'typescript\');\n\n';
    content += '// Set breakpoint\n';
    content += 'const bp = debugger.setBreakpoint(\'src/service.ts\', 42);\n\n';
    content += '// Check breakpoint in code\n';
    content += 'debugger.checkBreakpoint(__filename, __line, { userId: \'123\' });\n\n';
    content += '// Step execution\n';
    content += 'debugger.stepOver();\n';
    content += 'debugger.stepInto();\n';
    content += 'debugger.stepOut();\n\n';
    content += '// Variable inspection\n';
    content += 'debugger.setVariable(\'x\', 42);\n';
    content += 'console.log(debugger.getVariable(\'x\'));\n\n';
    content += '// Remote debugging\n';
    content += 'await debugger.connectToDebugger(\'localhost\', 9229);\n';
    content += 'debugger.sendCommand({ type: \'pause\' });\n';
    content += '```\n\n';
  } else if (config.language === 'python') {
    content += '```python\n';
    content += 'from polyglot_debugging import debugger\n\n';
    content += '# Start debugger\n';
    content += 'debugger.start()\n\n';
    content += '# Create session\n';
    content += 'session = debugger.create_session(\'trace-123\', \'python\')\n\n';
    content += '# Set breakpoint\n';
    content += 'bp = debugger.set_breakpoint(\'src/service.py\', 42)\n\n';
    content += '# Check breakpoint in code\n';
    content += 'debugger.check_breakpoint(__file__, 42, {\'userId\': \'123\'})\n\n';
    content += '# Step execution\n';
    content += 'debugger.step_over()\n';
    content += 'debugger.step_into()\n';
    content += 'debugger.step_out()\n\n';
    content += '# Variable inspection\n';
    content += 'debugger.set_variable(\'x\', 42)\n';
    content += 'print(debugger.get_variable(\'x\'))\n\n';
    content += '# Remote debugging\n';
    content += 'debugger.connect_to_debugger(\'localhost\', 9229)\n';
    content += 'debugger.send_command({\'type\': \'pause\'})\n';
    content += '```\n\n';
  } else if (config.language === 'go') {
    content += '```go\n';
    content += 'package main\n\n';
    content += 'import (\n';
    content += '    "fmt"\n';
    content += '    "your-module/polyglot-debugging"\n';
    content += ')\n\n';
    content += 'func main() {\n';
    content += '    debugger := polyglot_debugging.NewPolyglotDebugger(9229, true, true, true)\n';
    content += '    debugger.Start()\n\n';
    content += '    // Create session\n';
    content += '    session := debugger.CreateSession("trace-123", "go")\n\n';
    content += '    // Set breakpoint\n';
    content += '    bp, _ := debugger.SetBreakpoint("src/service.go", 42)\n\n';
    content += '    // Step execution\n';
    content += '    debugger.StepOver()\n';
    content += '    debugger.StepInto()\n\n';
    content += '    // Variable inspection\n';
    content += '    debugger.SetVariable("x", 42)\n';
    content += '    fmt.Println(debugger.GetVariable("x"))\n';
    content += '}\n';
    content += '```\n\n';
  }

  content += '## 📚 Features\n\n';
  content += '- **Cross-Service Breakpoints**: Set breakpoints that span multiple services\n';
  content += '- **Language Boundaries**: Step through code across different languages\n';
  content += '- **Variable Inspection**: Watch and modify variables during execution\n';
  content += '- **Remote Debugging**: Connect to debugger over network protocol\n';
  content += '- **Call Stack**: Inspect and navigate the call stack\n';
  content += '- **Event System**: Listen to debugger events for custom handling\n\n';

  content += '## 🔗 Debug Protocol\n\n';
  content += 'The debugger uses a JSON-based protocol for remote communication:\n\n';
  content += '```json\n';
  content += '{\n';
  content += '  "type": "pause",\n';
  content += '  "file": "src/service.ts",\n';
  content += '  "line": 42\n';
  content += '}\n';
  content += '```\n\n';

  content += 'Supported commands:\n';
  content += '- `pause` - Pause execution\n';
  content += '- `resume` - Resume execution\n';
  content += '- `step` - Step over\n';
  content += '- `stepInto` - Step into function\n';
  content += '- `stepOut` - Step out of function\n';
  content += '- `setBreakpoint` - Set breakpoint\n';
  content += '- `getVariables` - Get all variables\n\n';

  return content;
}

// Write files
export async function writeDebuggingFiles(
  config: DebuggingConfig,
  output: string
): Promise<void> {
  const ext = config.language === 'typescript' ? 'ts' : config.language === 'python' ? 'py' : 'go';
  const fileName = 'polyglot-debugging.' + ext;
  const filePath = path.join(output, fileName);

  let content: string;
  if (config.language === 'typescript') {
    content = generateTypeScriptDebugging(config);
  } else if (config.language === 'python') {
    content = generatePythonDebugging(config);
  } else if (config.language === 'go') {
    content = generateGoDebugging(config);
  } else {
    throw new Error('Unsupported language: ' + config.language);
  }

  await fs.ensureDir(output);
  await fs.writeFile(filePath, content);
  console.log(chalk.green('✅ Generated: ' + fileName));

  // Generate BUILD.md
  const buildMD = generateBuildMD(config);
  const buildMDPath = path.join(output, 'BUILD.md');
  await fs.writeFile(buildMDPath, buildMD);
  console.log(chalk.green('✅ Generated: BUILD.md'));

  // Generate package.json for TypeScript
  if (config.language === 'typescript') {
    const packageJson = {
      name: config.projectName.toLowerCase() + '-polyglot-debugging',
      version: '1.0.0',
      description: 'Polyglot debugging for ' + config.projectName,
      types: fileName,
      devDependencies: {
        '@types/node': '^20.0.0',
        typescript: '^5.0.0',
      },
    };

    const packageJsonPath = path.join(output, 'package.json');
    await fs.writeFile(packageJsonPath, JSON.stringify(packageJson, null, 2));
    console.log(chalk.green('✅ Generated: package.json'));
  }

  // Generate requirements.txt for Python
  if (config.language === 'python') {
    const requirements = [];

    const requirementsPath = path.join(output, 'requirements.txt');
    await fs.writeFile(requirementsPath, requirements.join('\n'));
    console.log(chalk.green('✅ Generated: requirements.txt'));
  }

  // Generate go.mod for Go
  if (config.language === 'go') {
    const goMod = 'module ' + config.projectName.toLowerCase() + '-debugging\n\n';
    const goModPath = path.join(output, 'go.mod');
    await fs.writeFile(goModPath, goMod);
    console.log(chalk.green('✅ Generated: go.mod'));
  }

  // Generate config JSON
  const debuggingConfig = {
    projectName: config.projectName,
    language: config.language,
    debugPort: config.debugPort,
    enableBreakpoints: config.enableBreakpoints,
    enableStepping: config.enableStepping,
    enableVariableWatch: config.enableVariableWatch,
    metadata: {
      generatedAt: new Date().toISOString(),
      version: '1.0.0',
    },
  };

  const configPath = path.join(output, 'debugging-config.json');
  await fs.writeFile(configPath, JSON.stringify(debuggingConfig, null, 2));
  console.log(chalk.green('✅ Generated: debugging-config.json'));
}
