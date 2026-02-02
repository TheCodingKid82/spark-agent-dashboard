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
  draft: "bg-gray-200 text-gray-700",
  in_review: "bg-amber-200 text-amber-700",
  approved: "bg-green-200 text-green-700",
  archived: "bg-gray-100 text-gray-500",
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
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-400"></div>
      </div>
    );
  }

  if (selectedDoc) {
    return (
      <div className="h-full flex flex-col">
        <div className="flex items-center justify-between mb-4">
          <button
            onClick={() => {
              setSelectedDoc(null);
              setIsEditing(false);
            }}
            className="text-sm text-gray-500 hover:text-gray-700"
          >
            ← Back to documents
          </button>
          <div className="flex gap-2">
            {!isEditing ? (
              <button
                onClick={() => {
                  setIsEditing(true);
                  setEditContent(selectedDoc.content);
                }}
                className="flex items-center gap-1 px-3 py-1.5 text-sm bg-gray-100 hover:bg-gray-200 rounded-lg"
              >
                <Pencil className="w-4 h-4" />
                Edit
              </button>
            ) : (
              <>
                <button
                  onClick={() => setIsEditing(false)}
                  className="px-3 py-1.5 text-sm text-gray-600 hover:text-gray-800"
                >
                  Cancel
                </button>
                <button
                  onClick={saveDocument}
                  className="flex items-center gap-1 px-3 py-1.5 text-sm bg-blue-500 text-white hover:bg-blue-600 rounded-lg"
                >
                  <CheckCircle className="w-4 h-4" />
                  Save
                </button>
              </>
            )}
          </div>
        </div>

        <div className="flex-1 overflow-auto">
          <h2 className="text-xl font-semibold mb-2">{selectedDoc.title}</h2>
          <div className="flex items-center gap-4 text-sm text-gray-500 mb-4">
            <span>v{selectedDoc.version}</span>
            <span className={`px-2 py-0.5 rounded-full text-xs ${STATUS_COLORS[selectedDoc.status]}`}>
              {selectedDoc.status.replace("_", " ")}
            </span>
            <span className="flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {formatDate(selectedDoc.updatedAt)}
            </span>
          </div>

          {isEditing ? (
            <textarea
              value={editContent}
              onChange={(e) => setEditContent(e.target.value)}
              className="w-full h-96 p-4 border rounded-lg font-mono text-sm resize-none focus:ring-2 focus:ring-blue-500"
            />
          ) : (
            <div className="prose prose-sm max-w-none">
              <pre className="whitespace-pre-wrap font-mono text-sm bg-gray-50 p-4 rounded-lg">
                {selectedDoc.content}
              </pre>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center justify-between mb-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search documents..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <button className="flex items-center gap-1 px-3 py-2 bg-blue-500 text-white hover:bg-blue-600 rounded-lg text-sm">
          <Plus className="w-4 h-4" />
          New
        </button>
      </div>

      <div className="flex-1 overflow-auto">
        {filteredDocuments.length === 0 ? (
          <div className="text-center py-12 text-gray-400">
            <FileText className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p>No documents found</p>
          </div>
        ) : (
          <div className="grid gap-3">
            {filteredDocuments.map((doc) => (
              <div
                key={doc.id}
                onClick={() => {
                  setSelectedDoc(doc);
                  onDocumentSelect?.(doc.id);
                }}
                className="p-4 border rounded-lg hover:border-blue-300 hover:shadow-sm cursor-pointer transition-all"
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <FileText className="w-5 h-5 text-blue-500" />
                    <div>
                      <h3 className="font-medium text-gray-900">{doc.title}</h3>
                      <p className="text-xs text-gray-500 mt-1">
                        by {doc.authorId} • {formatDate(doc.updatedAt)}
                      </p>
                    </div>
                  </div>
                  <span
                    className={`px-2 py-1 rounded-full text-xs ${STATUS_COLORS[doc.status]}`}
                  >
                    {doc.status.replace("_", " ")}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
