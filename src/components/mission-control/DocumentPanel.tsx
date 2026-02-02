"use client";

import { useState, useEffect } from "react";
import { FileText, Plus, Search, Clock, CheckCircle, Pencil } from "lucide-react";

type DocumentStatus = "draft" | "in_review" | "approved" | "archived";
type ContentType = "markdown" | "text" | "json";

interface Document {
  id: string;
  title: string;
  content: string;
  contentType: ContentType;
  authorId: string;
  status: DocumentStatus;
  version: number;
  createdAt: number;
  updatedAt: number;
  tags?: string[];
}

interface DocumentPanelProps {
  taskId?: string;
  onDocumentSelect?: (docId: string) => void;
}

const STATUS_COLORS: Record<DocumentStatus, string> = {
  draft: "bg-zinc-800/70 text-zinc-200 border border-zinc-700",
  in_review: "bg-amber-500/10 text-amber-300 border border-amber-500/20",
  approved: "bg-emerald-500/10 text-emerald-300 border border-emerald-500/20",
  archived: "bg-zinc-900/60 text-zinc-500 border border-zinc-800",
};

export function DocumentPanel({ taskId, onDocumentSelect }: DocumentPanelProps) {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedDoc, setSelectedDoc] = useState<Document | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState("");

  useEffect(() => {
    loadDocuments();
  }, [taskId]);

  async function loadDocuments() {
    try {
      const url = taskId ? `/api/documents?taskId=${taskId}` : "/api/documents";
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        setDocuments(data.documents || []);
      }
    } catch (error) {
      console.error("Failed to load documents:", error);
    } finally {
      setLoading(false);
    }
  }

  async function saveDocument() {
    if (!selectedDoc) return;
    try {
      const res = await fetch(`/api/documents/${selectedDoc.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: editContent }),
      });
      if (res.ok) {
        setSelectedDoc({ ...selectedDoc, content: editContent });
        setIsEditing(false);
      }
    } catch (error) {
      console.error("Failed to save document:", error);
    }
  }

  function formatDate(timestamp: number) {
    return new Date(timestamp).toLocaleDateString([], {
      month: "short",
      day: "numeric",
    });
  }

  const filteredDocuments = documents.filter(
    (doc) =>
      (doc.title?.toLowerCase() || "").includes(searchQuery.toLowerCase()) ||
      (doc.content?.toLowerCase() || "").includes(searchQuery.toLowerCase())
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-zinc-600"></div>
      </div>
    );
  }

  if (selectedDoc) {
    return (
      <div className="h-full flex flex-col p-4">
        <div className="flex items-center justify-between mb-4">
          <button
            onClick={() => {
              setSelectedDoc(null);
              setIsEditing(false);
            }}
            className="text-sm text-zinc-400 hover:text-zinc-200"
          >
            ← Back
          </button>
          <div className="flex gap-2">
            {!isEditing ? (
              <button
                onClick={() => {
                  setIsEditing(true);
                  setEditContent(selectedDoc.content);
                }}
                className="flex items-center gap-1 px-3 py-1.5 text-sm bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 rounded-lg"
              >
                <Pencil className="w-4 h-4" />
                Edit
              </button>
            ) : (
              <>
                <button
                  onClick={() => setIsEditing(false)}
                  className="px-3 py-1.5 text-sm text-zinc-400 hover:text-zinc-200"
                >
                  Cancel
                </button>
                <button
                  onClick={saveDocument}
                  className="flex items-center gap-1 px-3 py-1.5 text-sm bg-indigo-600 text-white hover:bg-indigo-500 rounded-lg"
                >
                  <CheckCircle className="w-4 h-4" />
                  Save
                </button>
              </>
            )}
          </div>
        </div>

        <div className="flex-1 overflow-auto rounded-xl border border-zinc-800 bg-zinc-900/40">
          <div className="p-4 border-b border-zinc-800/70">
            <h2 className="text-lg font-semibold text-zinc-100">{selectedDoc.title}</h2>
            <div className="flex items-center gap-3 text-xs text-zinc-500 mt-2">
              <span>v{selectedDoc.version}</span>
              <span className={`px-2 py-0.5 rounded-full ${STATUS_COLORS[selectedDoc.status || "draft"]}`}> 
                {(selectedDoc.status || "draft").replace("_", " ")}
              </span>
              <span className="flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {formatDate(selectedDoc.updatedAt)}
              </span>
            </div>
          </div>

          <div className="p-4">
            {isEditing ? (
              <textarea
                value={editContent}
                onChange={(e) => setEditContent(e.target.value)}
                className="w-full h-[28rem] p-4 bg-zinc-950/50 border border-zinc-800 rounded-lg font-mono text-sm text-zinc-100 resize-none focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
              />
            ) : (
              <pre className="whitespace-pre-wrap font-mono text-sm bg-zinc-950/40 border border-zinc-800 rounded-lg p-4 text-zinc-100">
                {selectedDoc.content}
              </pre>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col p-4">
      <div className="flex items-center justify-between mb-4 gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
          <input
            type="text"
            placeholder="Search documents…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-zinc-950/40 border border-zinc-800 rounded-lg pl-10 pr-4 py-2 text-sm text-zinc-100 placeholder-zinc-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
          />
        </div>
        <button
          className="flex items-center gap-1 px-3 py-2 bg-indigo-600 text-white hover:bg-indigo-500 rounded-lg text-sm"
          onClick={async () => {
            try {
              const now = Date.now();
              const tempId = `doc-${now}`;
              const tempDoc: Document = {
                id: tempId,
                title: "New document",
                content: "",
                contentType: "markdown",
                authorId: "current-user",
                status: "draft",
                version: 1,
                createdAt: now,
                updatedAt: now,
              };
              setDocuments((prev) => [tempDoc, ...prev]);
              setSelectedDoc(tempDoc);
              const res = await fetch("/api/documents", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(tempDoc),
              });
              if (res.ok) {
                const data = await res.json();
                const newId = data.documentId || data.id;
                if (newId && newId !== tempId) {
                  setDocuments((prev) => prev.map((d) => (d.id === tempId ? { ...d, id: newId } : d)));
                  setSelectedDoc((d) => (d?.id === tempId ? { ...d, id: newId } : d));
                }
              }
            } catch (e) {
              console.error("Failed to create doc", e);
            }
          }}
        >
          <Plus className="w-4 h-4" />
          New
        </button>
      </div>

      <div className="flex-1 overflow-auto rounded-xl border border-zinc-800 bg-zinc-900/40">
        {filteredDocuments.length === 0 ? (
          <div className="text-center py-16 text-zinc-500">
            <FileText className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p className="text-sm">No documents found</p>
          </div>
        ) : (
          <div className="divide-y divide-zinc-800/70">
            {filteredDocuments.map((doc) => (
              <button
                key={doc.id}
                onClick={() => {
                  setSelectedDoc(doc);
                  onDocumentSelect?.(doc.id);
                }}
                className="w-full text-left p-4 hover:bg-zinc-900/60 transition-colors"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <FileText className="w-5 h-5 text-indigo-300" />
                    <div className="min-w-0">
                      <h3 className="font-medium text-zinc-100 truncate">{doc.title}</h3>
                      <p className="text-xs text-zinc-500 mt-1">
                        by {doc.authorId} • {formatDate(doc.updatedAt)}
                      </p>
                    </div>
                  </div>
                  <span
                    className={`shrink-0 px-2 py-0.5 rounded-full text-xs ${STATUS_COLORS[doc.status || "draft"]}`}
                  >
                    {(doc.status || "draft").replace("_", " ")}
                  </span>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
