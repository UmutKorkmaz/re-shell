package main

import (
	"bufio"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"time"

	"github.com/charmbracelet/bubbles/spinner"
	tea "github.com/charmbracelet/bubbletea"
	"github.com/charmbracelet/lipgloss"
)

type ipcMessage struct {
	Type string          `json:"type"`
	ID   string          `json:"id"`
	Data json.RawMessage `json:"data"`
}

type ipcClient struct {
	in      io.Reader
	out     io.Writer
	mu      sync.Mutex
	pending map[string]chan ipcMessage
}

func newIPCClient(in io.Reader, out io.Writer) *ipcClient {
	return &ipcClient{
		in:      in,
		out:     out,
		pending: make(map[string]chan ipcMessage),
	}
}

func (c *ipcClient) start() {
	scanner := bufio.NewScanner(c.in)
	for scanner.Scan() {
		line := strings.TrimSpace(scanner.Text())
		if line == "" {
			continue
		}

		var message ipcMessage
		if err := json.Unmarshal([]byte(line), &message); err != nil {
			continue
		}

		c.mu.Lock()
		handler := c.pending[message.ID]
		if handler != nil {
			delete(c.pending, message.ID)
		}
		c.mu.Unlock()

		if handler != nil {
			handler <- message
			close(handler)
		}
	}
}

func (c *ipcClient) request(ctx context.Context, messageType string, data any, target any) error {
	id := fmt.Sprintf("%d", time.Now().UnixNano())
	dataBytes, err := json.Marshal(data)
	if err != nil {
		return err
	}

	message := ipcMessage{
		Type: messageType,
		ID:   id,
		Data: dataBytes,
	}

	response := make(chan ipcMessage, 1)
	c.mu.Lock()
	c.pending[id] = response
	c.mu.Unlock()

	if err := c.send(message); err != nil {
		c.mu.Lock()
		delete(c.pending, id)
		c.mu.Unlock()
		return err
	}

	select {
	case <-ctx.Done():
		c.mu.Lock()
		delete(c.pending, id)
		c.mu.Unlock()
		return ctx.Err()
	case reply := <-response:
		if reply.Type == "error" {
			var errorPayload struct {
				Message string `json:"message"`
			}
			_ = json.Unmarshal(reply.Data, &errorPayload)
			if errorPayload.Message == "" {
				errorPayload.Message = "unknown IPC error"
			}
			return errors.New(errorPayload.Message)
		}

		if target == nil {
			return nil
		}
		return json.Unmarshal(reply.Data, target)
	}
}

func (c *ipcClient) send(message ipcMessage) error {
	c.mu.Lock()
	defer c.mu.Unlock()

	payload, err := json.Marshal(message)
	if err != nil {
		return err
	}

	_, err = fmt.Fprintln(c.out, string(payload))
	return err
}

type projectInfo struct {
	Name        string `json:"name"`
	Version     string `json:"version"`
	Description string `json:"description"`
	Path        string `json:"path"`
	Type        string `json:"type"`
}

type directoryEntry struct {
	Name        string `json:"name"`
	Path        string `json:"path"`
	IsDirectory bool   `json:"isDirectory"`
	Size        int64  `json:"size"`
	Modified    string `json:"modified"`
}

type projectLoadedMsg projectInfo
type entriesLoadedMsg []directoryEntry

type loadErrorMsg struct {
	Message string
}

type model struct {
	ipc         *ipcClient
	spinner     spinner.Model
	projectPath string
	info        projectInfo
	entries     []directoryEntry
	selected    int
	loading     bool
	err         string
	width       int
	height      int
}

func newModel(ipc *ipcClient, projectPath string) model {
	spin := spinner.New()
	spin.Spinner = spinner.Dot
	spin.Style = lipgloss.NewStyle().Foreground(lipgloss.Color("39"))

	return model{
		ipc:         ipc,
		spinner:     spin,
		projectPath: projectPath,
		loading:     true,
	}
}

func (m model) Init() tea.Cmd {
	return tea.Batch(m.spinner.Tick, loadProject(m.ipc, m.projectPath))
}

func (m model) Update(msg tea.Msg) (tea.Model, tea.Cmd) {
	switch typed := msg.(type) {
	case tea.WindowSizeMsg:
		m.width = typed.Width
		m.height = typed.Height
	case tea.KeyMsg:
		switch typed.String() {
		case "q", "ctrl+c", "esc":
			return m, tea.Quit
		case "r":
			m.loading = true
			m.err = ""
			return m, tea.Batch(m.spinner.Tick, loadProject(m.ipc, m.projectPath))
		case "up", "k":
			if m.selected > 0 {
				m.selected--
			}
		case "down", "j":
			if m.selected < len(m.entries)-1 {
				m.selected++
			}
		}
	case spinner.TickMsg:
		var cmd tea.Cmd
		m.spinner, cmd = m.spinner.Update(msg)
		return m, cmd
	case projectLoadedMsg:
		m.info = projectInfo(typed)
		m.projectPath = m.info.Path
		return m, loadEntries(m.ipc, m.projectPath)
	case entriesLoadedMsg:
		m.entries = []directoryEntry(typed)
		m.loading = false
		if m.selected >= len(m.entries) {
			m.selected = 0
		}
	case loadErrorMsg:
		m.err = typed.Message
		m.loading = false
	}

	return m, nil
}

func (m model) View() string {
	titleStyle := lipgloss.NewStyle().Bold(true).Foreground(lipgloss.Color("39"))
	labelStyle := lipgloss.NewStyle().Foreground(lipgloss.Color("244"))
	selectedStyle := lipgloss.NewStyle().Foreground(lipgloss.Color("230")).Background(lipgloss.Color("62"))
	errorStyle := lipgloss.NewStyle().Foreground(lipgloss.Color("203")).Bold(true)

	var out strings.Builder
	out.WriteString(titleStyle.Render("Re-Shell TUI"))
	out.WriteString("\n\n")

	if m.loading {
		out.WriteString(m.spinner.View())
		out.WriteString(" Loading project data...\n")
	} else if m.err != "" {
		out.WriteString(errorStyle.Render("Error: " + m.err))
		out.WriteString("\n")
	} else {
		out.WriteString(labelStyle.Render("Project: "))
		out.WriteString(defaultString(m.info.Name, filepath.Base(m.projectPath)))
		out.WriteString("\n")
		out.WriteString(labelStyle.Render("Version: "))
		out.WriteString(defaultString(m.info.Version, "0.0.0"))
		out.WriteString("\n")
		out.WriteString(labelStyle.Render("Type: "))
		out.WriteString(defaultString(m.info.Type, "unknown"))
		out.WriteString("\n")
		out.WriteString(labelStyle.Render("Path: "))
		out.WriteString(m.projectPath)
		out.WriteString("\n")

		if m.info.Description != "" {
			out.WriteString(labelStyle.Render("Description: "))
			out.WriteString(m.info.Description)
			out.WriteString("\n")
		}

		out.WriteString("\n")
		out.WriteString(titleStyle.Render("Files"))
		out.WriteString("\n")

		limit := len(m.entries)
		if m.height > 10 && limit > m.height-10 {
			limit = m.height - 10
		}
		for i := 0; i < limit; i++ {
			entry := m.entries[i]
			prefix := "  "
			if entry.IsDirectory {
				prefix = "d "
			}
			line := fmt.Sprintf("%s%s", prefix, entry.Name)
			if i == m.selected {
				line = selectedStyle.Render(line)
			}
			out.WriteString(line)
			out.WriteString("\n")
		}
	}

	out.WriteString("\n")
	out.WriteString(labelStyle.Render("q quit  r reload  up/down navigate"))
	out.WriteString("\n")
	return out.String()
}

func loadProject(ipc *ipcClient, projectPath string) tea.Cmd {
	return func() tea.Msg {
		ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()

		var info projectInfo
		if err := ipc.request(ctx, "get-project-info", map[string]string{"path": projectPath}, &info); err != nil {
			return loadErrorMsg{Message: err.Error()}
		}

		if info.Path == "" {
			info.Path = projectPath
		}
		return projectLoadedMsg(info)
	}
}

func loadEntries(ipc *ipcClient, projectPath string) tea.Cmd {
	return func() tea.Msg {
		ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()

		var entries []directoryEntry
		if err := ipc.request(ctx, "list-directory", map[string]string{"path": projectPath}, &entries); err != nil {
			return loadErrorMsg{Message: err.Error()}
		}

		return entriesLoadedMsg(entries)
	}
}

func defaultString(value string, fallback string) string {
	if strings.TrimSpace(value) == "" {
		return fallback
	}
	return value
}

func openTTY() (*os.File, *os.File, error) {
	input, err := os.OpenFile("/dev/tty", os.O_RDONLY, 0)
	if err != nil {
		return nil, nil, err
	}

	output, err := os.OpenFile("/dev/tty", os.O_WRONLY, 0)
	if err != nil {
		_ = input.Close()
		return nil, nil, err
	}

	return input, output, nil
}

func main() {
	ipc := newIPCClient(os.Stdin, os.Stdout)
	go ipc.start()

	projectPath := os.Getenv("RESHELL_PROJECT_PATH")
	if projectPath == "" {
		projectPath, _ = os.Getwd()
	}

	input, output, err := openTTY()
	if err != nil {
		fmt.Fprintln(os.Stderr, "Failed to open terminal:", err)
		os.Exit(1)
	}
	defer input.Close()
	defer output.Close()

	program := tea.NewProgram(
		newModel(ipc, projectPath),
		tea.WithInput(input),
		tea.WithOutput(output),
		tea.WithAltScreen(),
	)

	if _, err := program.Run(); err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}
}
