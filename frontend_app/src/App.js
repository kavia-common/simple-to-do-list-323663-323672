import React, { useEffect, useMemo, useRef, useState } from "react";
import "./App.css";

/**
 * Storage key for persisting todos in localStorage.
 * Keep stable to avoid data loss across deployments.
 */
const STORAGE_KEY = "kavia.todos.v1";

/**
 * @typedef {{ id: string, title: string, completed: boolean, createdAt: number, updatedAt: number }} Todo
 */

/**
 * Creates a reasonably-unique id without adding dependencies.
 * This is sufficient for local-only storage.
 * @returns {string}
 */
function createId() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

/**
 * Safely parse todos from localStorage, returning an array on any error.
 * @returns {Todo[]}
 */
function loadTodosFromStorage() {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);

    if (!Array.isArray(parsed)) return [];
    // Minimal shape validation; tolerate older data.
    return parsed
      .filter((t) => t && typeof t === "object")
      .map((t) => ({
        id: typeof t.id === "string" ? t.id : createId(),
        title: typeof t.title === "string" ? t.title : "",
        completed: Boolean(t.completed),
        createdAt: typeof t.createdAt === "number" ? t.createdAt : Date.now(),
        updatedAt: typeof t.updatedAt === "number" ? t.updatedAt : Date.now(),
      }))
      .filter((t) => t.title.trim().length > 0);
  } catch {
    return [];
  }
}

/**
 * Persist todos to localStorage.
 * @param {Todo[]} todos
 */
function saveTodosToStorage(todos) {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(todos));
}

const FILTERS = /** @type {const} */ (["all", "active", "completed"]);

/**
 * Format for counts label.
 * @param {number} n
 */
function pluralizeTask(n) {
  return n === 1 ? "task" : "tasks";
}

// PUBLIC_INTERFACE
function App() {
  const [todos, setTodos] = useState(() => loadTodosFromStorage());
  const [newTitle, setNewTitle] = useState("");
  const [filter, setFilter] = useState("all");
  const [editingId, setEditingId] = useState(/** @type {string|null} */ (null));
  const [editingTitle, setEditingTitle] = useState("");

  const newInputRef = useRef(/** @type {HTMLInputElement|null} */ (null));
  const editInputRef = useRef(/** @type {HTMLInputElement|null} */ (null));

  // Persist whenever todos change.
  useEffect(() => {
    saveTodosToStorage(todos);
  }, [todos]);

  // Keep focus friendly.
  useEffect(() => {
    if (editingId && editInputRef.current) {
      editInputRef.current.focus();
      editInputRef.current.select();
    }
  }, [editingId]);

  const stats = useMemo(() => {
    const total = todos.length;
    const completed = todos.filter((t) => t.completed).length;
    const active = total - completed;
    return { total, completed, active };
  }, [todos]);

  const visibleTodos = useMemo(() => {
    if (filter === "active") return todos.filter((t) => !t.completed);
    if (filter === "completed") return todos.filter((t) => t.completed);
    return todos;
  }, [todos, filter]);

  /**
   * Create a new todo from input.
   */
  const addTodo = () => {
    const title = newTitle.trim();
    if (!title) return;

    const now = Date.now();
    const todo = {
      id: createId(),
      title,
      completed: false,
      createdAt: now,
      updatedAt: now,
    };

    setTodos((prev) => [todo, ...prev]);
    setNewTitle("");
    // Keep rapid entry comfortable.
    newInputRef.current?.focus();
  };

  /**
   * Toggle completion state for a todo.
   * @param {string} id
   */
  const toggleTodo = (id) => {
    setTodos((prev) =>
      prev.map((t) =>
        t.id === id ? { ...t, completed: !t.completed, updatedAt: Date.now() } : t
      )
    );
  };

  /**
   * Delete a todo.
   * @param {string} id
   */
  const deleteTodo = (id) => {
    setTodos((prev) => prev.filter((t) => t.id !== id));
    if (editingId === id) {
      setEditingId(null);
      setEditingTitle("");
    }
  };

  /**
   * Start editing a todo.
   * @param {Todo} todo
   */
  const startEditing = (todo) => {
    setEditingId(todo.id);
    setEditingTitle(todo.title);
  };

  /**
   * Save current edit.
   */
  const commitEdit = () => {
    if (!editingId) return;

    const title = editingTitle.trim();
    if (!title) {
      // If user clears title, treat as delete (common UX).
      deleteTodo(editingId);
      return;
    }

    setTodos((prev) =>
      prev.map((t) =>
        t.id === editingId ? { ...t, title, updatedAt: Date.now() } : t
      )
    );
    setEditingId(null);
    setEditingTitle("");
  };

  /**
   * Cancel current edit.
   */
  const cancelEdit = () => {
    setEditingId(null);
    setEditingTitle("");
  };

  /**
   * Clear all completed todos.
   */
  const clearCompleted = () => {
    setTodos((prev) => prev.filter((t) => !t.completed));
  };

  /**
   * Mark all todos complete/incomplete.
   */
  const toggleAll = () => {
    if (todos.length === 0) return;
    const shouldCompleteAll = todos.some((t) => !t.completed);
    setTodos((prev) =>
      prev.map((t) => ({
        ...t,
        completed: shouldCompleteAll,
        updatedAt: Date.now(),
      }))
    );
  };

  return (
    <div className="App" data-theme="light">
      <main className="page">
        <header className="header">
          <div className="brand">
            <div className="brandMark" aria-hidden="true" />
            <div>
              <h1 className="title">To‑Do List</h1>
              <p className="subtitle">
                Stay on track with a simple, clean checklist.
              </p>
            </div>
          </div>

          <div className="stats" aria-label="Task statistics">
            <span className="statPill">
              <strong>{stats.active}</strong> active
            </span>
            <span className="statPill">
              <strong>{stats.completed}</strong> completed
            </span>
          </div>
        </header>

        <section className="card" aria-label="Add a task">
          <div className="inputRow">
            <label className="srOnly" htmlFor="new-task">
              Add a new task
            </label>
            <input
              id="new-task"
              ref={newInputRef}
              className="textInput"
              type="text"
              value={newTitle}
              placeholder="Add a task…"
              onChange={(e) => setNewTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") addTodo();
              }}
              autoComplete="off"
            />
            <button
              className="btnPrimary"
              onClick={addTodo}
              disabled={newTitle.trim().length === 0}
              type="button"
            >
              Add
            </button>
          </div>

          <div className="toolbar" aria-label="Task actions">
            <div className="filters" role="tablist" aria-label="Filter tasks">
              {FILTERS.map((f) => (
                <button
                  key={f}
                  type="button"
                  className={f === filter ? "chip chipActive" : "chip"}
                  onClick={() => setFilter(f)}
                  aria-pressed={f === filter}
                >
                  {f === "all" ? "All" : f === "active" ? "Active" : "Completed"}
                </button>
              ))}
            </div>

            <div className="toolbarRight">
              <button
                type="button"
                className="btnGhost"
                onClick={toggleAll}
                disabled={todos.length === 0}
                title="Toggle all tasks"
              >
                Toggle all
              </button>
              <button
                type="button"
                className="btnDanger"
                onClick={clearCompleted}
                disabled={stats.completed === 0}
                title="Remove all completed tasks"
              >
                Clear completed
              </button>
            </div>
          </div>
        </section>

        <section className="card cardList" aria-label="Task list">
          {todos.length === 0 ? (
            <div className="emptyState">
              <h2 className="emptyTitle">No tasks yet</h2>
              <p className="emptyText">
                Add your first task above. Tasks are saved locally in your browser.
              </p>
            </div>
          ) : visibleTodos.length === 0 ? (
            <div className="emptyState">
              <h2 className="emptyTitle">Nothing to show</h2>
              <p className="emptyText">
                Try switching filters to see other tasks.
              </p>
            </div>
          ) : (
            <ul className="todoList">
              {visibleTodos.map((todo) => {
                const isEditing = editingId === todo.id;

                return (
                  <li
                    key={todo.id}
                    className={todo.completed ? "todoItem todoDone" : "todoItem"}
                  >
                    <div className="todoLeft">
                      <label className="checkWrap">
                        <input
                          type="checkbox"
                          checked={todo.completed}
                          onChange={() => toggleTodo(todo.id)}
                          aria-label={
                            todo.completed
                              ? `Mark "${todo.title}" as not completed`
                              : `Mark "${todo.title}" as completed`
                          }
                        />
                        <span className="checkUi" aria-hidden="true" />
                      </label>

                      {!isEditing ? (
                        <button
                          type="button"
                          className="todoTitleBtn"
                          onDoubleClick={() => startEditing(todo)}
                          onClick={() => toggleTodo(todo.id)}
                          title="Click to toggle complete. Double-click to edit."
                        >
                          <span className="todoTitle">{todo.title}</span>
                        </button>
                      ) : (
                        <div className="editRow">
                          <label className="srOnly" htmlFor={`edit-${todo.id}`}>
                            Edit task title
                          </label>
                          <input
                            id={`edit-${todo.id}`}
                            ref={editInputRef}
                            className="textInput textInputSmall"
                            type="text"
                            value={editingTitle}
                            onChange={(e) => setEditingTitle(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") commitEdit();
                              if (e.key === "Escape") cancelEdit();
                            }}
                          />
                          <button
                            type="button"
                            className="btnPrimary btnSmall"
                            onClick={commitEdit}
                          >
                            Save
                          </button>
                          <button
                            type="button"
                            className="btnGhost btnSmall"
                            onClick={cancelEdit}
                          >
                            Cancel
                          </button>
                        </div>
                      )}
                    </div>

                    <div className="todoActions">
                      {!isEditing && (
                        <button
                          type="button"
                          className="iconBtn"
                          onClick={() => startEditing(todo)}
                          aria-label={`Edit "${todo.title}"`}
                          title="Edit"
                        >
                          Edit
                        </button>
                      )}
                      <button
                        type="button"
                        className="iconBtn iconBtnDanger"
                        onClick={() => deleteTodo(todo.id)}
                        aria-label={`Delete "${todo.title}"`}
                        title="Delete"
                      >
                        Delete
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}

          <footer className="listFooter" aria-label="List footer">
            <div className="count">
              <strong>{stats.total}</strong> {pluralizeTask(stats.total)} total
            </div>
            <div className="hint">
              Tip: double‑click a task (or press Edit) to rename it.
            </div>
          </footer>
        </section>

        <footer className="appFooter">
          <span>Saved in localStorage · Works offline</span>
        </footer>
      </main>
    </div>
  );
}

export default App;
