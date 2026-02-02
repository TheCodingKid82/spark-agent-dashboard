"use client";

import { useState } from "react";
import { FileText, Plus, Search, Clock, CheckCircle, Pencil, Trash2 } from "lucide-react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";

type DocumentStatus = "draft" | "in_review" | "approved" | "archived";

interface Document {
  _id: Id<"documents">;
  title: string;
  content: string;
  contentType: "markdown" | "text" | "json";
  authorId: string;
  status: DocumentStatus;
  version: number;
  tags?: string[];
  _creationTime: number;
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
  const documents = useQuery(api.documents.getAll, { limit: 100 });
  const createDocument = useMutation(api.documents.create);
  const updateDocument = useMutation(api.documents.update);
  const deleteDocument = useMutation(api.documents.remove);
  
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedDoc, setSelectedDoc] = useState<Document | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState("");
  const [editTitle, setEditTitle] = useState("");
  const [creating, setCreating] = useState(false);

  async function handleCreateDocument() {
    if (creating) return;
    setCreating(true);
    
    try {
      const docId = await createDocument({
        title: "New document",
        content: "# New Document\n\nStart writing here...",
        contentType: "markdown",
        authorId: "henry",
        status: "draft",
      });
      
      // Find and select the new document
      if (docId && documents) {
        const newDoc = documents.find(d => d._id === docId);
        if (newDoc) {
          setSelectedDoc(newDoc as Document);
          setIsEditing(true);
          setEditTitle(newDoc.title);
          setEditContent(newDoc.content);
        }
      }
    } catch (error) {
      console.error("Failed to create document:", error);
    } finally {
      setCreating(false);
    }
  }

  async function handleSaveDocument() {
    if (!selectedDoc) return;
    
    try {
      await updateDocument({
        id: selectedDoc._id,
        updatedBy: "henry",
        title: editTitle,
        content: editContent,
      });
      
      setSelectedDoc({ ...selectedDoc, title: editTitle, content: editContent });
      setIsEditing(false);
    } catch (error) {
      console.error("Failed to save document:", error);
    }
  }

  async function handleDeleteDocument(docId: Id<"documents">) {
    if (!confirm("Delete this document?")) return;
    
    try {
      await deleteDocument({ id: docId });
      setSelectedDoc(null);
    } catch (error) {
      console.error("Failed to delete document:", error);
    }
  }

  function formatDate(timestamp: number) {
    return new Date(timestamp).toLocaleDateString([], {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  // Loading state
  if (documents === undefined) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-400"></div>
      </div>
    );
  }

  const filteredDocuments = (documents || []).filter(
    (doc) =>
      (doc.title?.toLowerCase() || "").includes(searchQuery.toLowerCase()) ||
      (doc.content?.toLowerCase() || "").includes(searchQuery.toLowerCase())
  );

  // Document Detail View
  if (selectedDoc) {
    return (
      <div className="h-full flex flex-col p-4">
        <div className="flex items-center justify-between mb-4">
          <button
            onClick={() => {
              setSelectedDoc(null);
              setIsEditing(false);
            }}
            className="text-sm text-zinc-400 hover:text-zinc-200 transition-colors"
          >
            ← Back to list
          </button>
          <div className="flex gap-2">
            {!isEditing ? (
              <>
                <button
                  onClick={() => {
                    setIsEditing(true);
                    setEditTitle(selectedDoc.title);
                    setEditContent(selectedDoc.content);
                  }}
                  className="flex items-center gap-1 px-3 py-1.5 text-sm bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 rounded-lg text-zinc-100 transition-colors"
                >
                  <Pencil className="w-4 h-4" />
                  Edit
                </button>
                <button
                  onClick={() => handleDeleteDocument(selectedDoc._id)}
                  className="flex items-center gap-1 px-3 py-1.5 text-sm bg-red-900/20 border border-red-800/30 hover:bg-red-900/40 rounded-lg text-red-300 transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={() => setIsEditing(false)}
                  className="px-3 py-1.5 text-sm text-zinc-400 hover:text-zinc-200"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveDocument}
                  className="flex items-center gap-1 px-3 py-1.5 text-sm bg-indigo-600 text-white hover:bg-indigo-500 rounded-lg transition-colors"
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
            {isEditing ? (
              <input
                type="text"
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                className="w-full text-lg font-semibold text-zinc-100 bg-transparent border-b border-zinc-700 pb-2 focus:outline-none focus:border-indigo-500"
                placeholder="Document title..."
              />
            ) : (
              <h2 className="text-lg font-semibold text-zinc-100">{selectedDoc.title}</h2>
            )}
            <div className="flex items-center gap-3 text-xs text-zinc-500 mt-2">
              <span>v{selectedDoc.version}</span>
              <span className={`px-2 py-0.5 rounded-full ${STATUS_COLORS[selectedDoc.status]}`}>
                {selectedDoc.status.replace("_", " ")}
              </span>
              <span className="flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {formatDate(selectedDoc._creationTime)}
              </span>
            </div>
          </div>

          <div className="p-4">
            {isEditing ? (
              <textarea
                value={editContent}
                onChange={(e) => setEditContent(e.target.value)}
                className="w-full h-[28rem] p-4 bg-zinc-950/50 border border-zinc-800 rounded-lg font-mono text-sm text-zinc-100 resize-none focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
                placeholder="Start writing..."
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

  // Document List View
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
          className={`flex items-center gap-1 px-3 py-2 rounded-lg text-sm transition-colors ${
            creating 
              ? 'bg-indigo-700 text-white' 
              : 'bg-indigo-600 text-white hover:bg-indigo-500'
          }`}
          onClick={handleCreateDocument}
          disabled={creating}
        >
          <Plus className={`w-4 h-4 ${creating ? 'animate-spin' : ''}`} />
          New
        </button>
      </div>

      <div className="flex-1 overflow-auto rounded-xl border border-zinc-800 bg-zinc-900/40">
        {filteredDocuments.length === 0 ? (
          <div className="text-center py-16 text-zinc-500">
            <FileText className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p className="text-sm">No documents found</p>
            <button
              onClick={handleCreateDocument}
              className="mt-4 text-indigo-400 hover:text-indigo-300 text-sm"
            >
              Create your first document
            </button>
          </div>
        ) : (
          <div className="divide-y divide-zinc-800/70">
            {filteredDocuments.map((doc) => (
              <button
                key={doc._id}
                onClick={() => {
                  setSelectedDoc(doc as Document);
                  onDocumentSelect?.(doc._id);
                }}
                className="w-full text-left p-4 hover:bg-zinc-900/60 transition-colors"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <FileText className="w-5 h-5 text-indigo-300 shrink-0" />
                    <div className="min-w-0">
                      <h3 className="font-medium text-zinc-100 truncate">{doc.title}</h3>
                      <p className="text-xs text-zinc-500 mt-1">
                        by {doc.authorId} • {formatDate(doc._creationTime)}
                      </p>
                    </div>
                  </div>
                  <span
                    className={`shrink-0 px-2 py-0.5 rounded-full text-xs ${STATUS_COLORS[doc.status]}`}
                  >
                    {doc.status.replace("_", " ")}
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
