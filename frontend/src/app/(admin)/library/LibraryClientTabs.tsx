"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Book,
  BookOpen,
  Users,
  AlertCircle,
  Plus,
  Search,
  CheckCircle,
  FileText,
  UserPlus,
  CornerDownLeft,
  CornerDownRight,
  TrendingUp,
} from "lucide-react";
import {
  saveBook,
  registerLibraryMember,
  issueBook,
  returnBook,
} from "./actions";

interface BookCatalog {
  id: string;
  title: string;
  author: string;
  publisher?: string | null;
  edition?: string | null;
  subject?: string | null;
  category?: string | null;
  rackLocation?: string | null;
  totalCopies: number;
  availableCopies: number;
  copies: {
    id: string;
    barcodeNumber: string;
    isAvailable: boolean;
    condition: string;
  }[];
}

interface LibraryMember {
  id: string;
  memberCardNumber: string;
  memberType: string;
  name: string;
  maxBooksAllowed: number;
  loanPeriodDays: number;
}

interface BookIssue {
  id: string;
  barcodeNumber: string;
  title: string;
  memberCardNumber: string;
  memberName: string;
  issuedAt: string;
  dueDate: string;
  returnedAt: string | null;
  status: string;
}

interface LibraryClientTabsProps {
  booksList: BookCatalog[];
  membersList: LibraryMember[];
  issuesList: BookIssue[];
  studentsList: { id: string; name: string }[];
  staffList: { id: string; name: string }[];
  role: string;
  userId: string;
}

export default function LibraryClientTabs({
  booksList,
  membersList,
  issuesList,
  studentsList,
  staffList,
  role,
  userId,
}: LibraryClientTabsProps) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<
    "overview" | "books" | "members" | "transactions"
  >("overview");

  // Filter States
  const [bookSearch, setBookSearch] = useState("");
  const [memberSearch, setMemberSearch] = useState("");

  // Modals States
  const [bookModalOpen, setBookModalOpen] = useState(false);
  const [memberModalOpen, setMemberModalOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Forms States
  const [newBook, setNewBook] = useState({
    title: "",
    author: "",
    publisher: "",
    edition: "",
    subject: "",
    category: "",
    rackLocation: "",
    copiesCount: 2,
  });

  const [newMember, setNewMember] = useState({
    memberType: "STUDENT" as "STUDENT" | "STAFF",
    memberRefId: "",
    memberCardNumber: "",
    maxBooksAllowed: 3,
    loanPeriodDays: 14,
  });

  const [checkoutData, setCheckoutData] = useState({
    barcodeNumber: "",
    memberCardNumber: "",
  });

  const [returnValues, setReturnValues] = useState({
    issueId: "",
    fineAmount: 0,
    condition: "GOOD",
  });

  // Calculate Overview Stats
  const totalBooks = booksList.reduce((acc, curr) => acc + curr.totalCopies, 0);
  const activeCheckouts = issuesList.filter(
    (i) => i.returnedAt === null,
  ).length;
  const totalMembers = membersList.length;

  // Handlers
  async function handleAddBook(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setErrorMsg(null);
    try {
      const res = await saveBook(newBook);
      if (res.success) {
        setBookModalOpen(false);
        setNewBook({
          title: "",
          author: "",
          publisher: "",
          edition: "",
          subject: "",
          category: "",
          rackLocation: "",
          copiesCount: 2,
        });
        router.refresh();
      }
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to save book catalog");
    } finally {
      setLoading(false);
    }
  }

  async function handleRegisterMember(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setErrorMsg(null);
    try {
      const res = await registerLibraryMember(newMember);
      if (res.success) {
        setMemberModalOpen(false);
        setNewMember({
          memberType: "STUDENT",
          memberRefId: "",
          memberCardNumber: "",
          maxBooksAllowed: 3,
          loanPeriodDays: 14,
        });
        router.refresh();
      } else {
        setErrorMsg(res.message || "Failed to register member");
      }
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to register member");
    } finally {
      setLoading(false);
    }
  }

  async function handleCheckout(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setErrorMsg(null);
    try {
      const res = await issueBook(checkoutData);
      if (res.success) {
        setCheckoutData({ barcodeNumber: "", memberCardNumber: "" });
        router.refresh();
      } else {
        setErrorMsg(res.message || "Failed to check out book");
      }
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to check out book");
    } finally {
      setLoading(false);
    }
  }

  async function handleReturn(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setErrorMsg(null);
    try {
      const res = await returnBook(returnValues);
      if (res.success) {
        setReturnValues({ issueId: "", fineAmount: 0, condition: "GOOD" });
        router.refresh();
      } else {
        setErrorMsg(res.message || "Failed to process return");
      }
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to process return");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Dynamic Error Banner */}
      {errorMsg && (
        <div className="bg-danger/10 border border-danger/30 rounded-xl p-4 flex items-center gap-3 text-danger text-sm">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Control Tabs */}
      <div className="flex border-b border-border bg-card p-1 rounded-xl max-w-md shadow-sm">
        {(["overview", "books", "members", "transactions"] as const).map(
          (tab) => (
            <button
              key={tab}
              onClick={() => {
                setActiveTab(tab);
                setErrorMsg(null);
              }}
              className={`flex-1 py-2 text-xs font-semibold rounded-lg capitalize transition-all ${
                activeTab === tab
                  ? "bg-primary text-white shadow-sm"
                  : "text-muted-foreground hover:bg-muted"
              }`}
            >
              {tab}
            </button>
          ),
        )}
      </div>

      {/* Tab contents */}
      {activeTab === "overview" && (
        <div className="space-y-6">
          {/* Key Metrics */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-card border border-border p-6 rounded-xl flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
                <Book className="w-6 h-6" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground font-semibold">
                  Total Catalog Copies
                </p>
                <p className="text-2xl font-bold text-foreground mt-0.5">
                  {totalBooks}
                </p>
              </div>
            </div>
            <div className="bg-card border border-border p-6 rounded-xl flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-secondary/10 flex items-center justify-center text-secondary">
                <BookOpen className="w-6 h-6" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground font-semibold">
                  Active Checked Out
                </p>
                <p className="text-2xl font-bold text-foreground mt-0.5">
                  {activeCheckouts}
                </p>
              </div>
            </div>
            <div className="bg-card border border-border p-6 rounded-xl flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-warning/10 flex items-center justify-center text-warning">
                <Users className="w-6 h-6" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground font-semibold">
                  Registered Members
                </p>
                <p className="text-2xl font-bold text-foreground mt-0.5">
                  {totalMembers}
                </p>
              </div>
            </div>
          </div>

          {/* Quick Transactions & Double-Column Issue/Return Forms */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Left: Issue Book form */}
            <div className="bg-card border border-border rounded-xl p-6 space-y-4 shadow-sm">
              <h3 className="font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <CornerDownRight className="w-5 h-5 text-primary" /> Book
                Checkout (Issue)
              </h3>
              <form onSubmit={handleCheckout} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-muted-foreground mb-1">
                    Book Copy Barcode (e.g. BC-INT-02)
                  </label>
                  <input
                    type="text"
                    required
                    value={checkoutData.barcodeNumber}
                    onChange={(e) =>
                      setCheckoutData({
                        ...checkoutData,
                        barcodeNumber: e.target.value,
                      })
                    }
                    className="w-full px-3 py-2 border border-border rounded-lg bg-background text-sm"
                    placeholder="Enter copy barcode number"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-muted-foreground mb-1">
                    Library Card Number (e.g. LIB-ST-1001)
                  </label>
                  <input
                    type="text"
                    required
                    value={checkoutData.memberCardNumber}
                    onChange={(e) =>
                      setCheckoutData({
                        ...checkoutData,
                        memberCardNumber: e.target.value,
                      })
                    }
                    className="w-full px-3 py-2 border border-border rounded-lg bg-background text-sm"
                    placeholder="Enter member library card number"
                  />
                </div>
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-2 bg-primary hover:bg-primary/95 text-white font-semibold text-xs rounded-lg transition-colors"
                >
                  {loading ? "Processing checkout..." : "Confirm Book Issue"}
                </button>
              </form>
            </div>

            {/* Right: Return Book form */}
            <div className="bg-card border border-border rounded-xl p-6 space-y-4 shadow-sm">
              <h3 className="font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <CornerDownLeft className="w-5 h-5 text-secondary" /> Book
                Return & Fines
              </h3>
              <form onSubmit={handleReturn} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-muted-foreground mb-1">
                    Select Active Checked-out Book
                  </label>
                  <select
                    required
                    value={returnValues.issueId}
                    onChange={(e) =>
                      setReturnValues({
                        ...returnValues,
                        issueId: e.target.value,
                      })
                    }
                    className="w-full px-3 py-2 border border-border rounded-lg bg-background text-sm"
                  >
                    <option value="">-- Choose checked-out copy --</option>
                    {issuesList
                      .filter((i) => i.returnedAt === null)
                      .map((i) => (
                        <option key={i.id} value={i.id}>
                          {i.barcodeNumber} ({i.title}) - {i.memberName}
                        </option>
                      ))}
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-muted-foreground mb-1">
                      Return Book Condition
                    </label>
                    <select
                      value={returnValues.condition}
                      onChange={(e) =>
                        setReturnValues({
                          ...returnValues,
                          condition: e.target.value,
                        })
                      }
                      className="w-full px-3 py-2 border border-border rounded-lg bg-background text-sm"
                    >
                      <option value="GOOD">Good / Fine</option>
                      <option value="DAMAGED">Damaged</option>
                      <option value="LOST">Lost</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-muted-foreground mb-1">
                      Manual Fine Amount (₹)
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={returnValues.fineAmount}
                      onChange={(e) =>
                        setReturnValues({
                          ...returnValues,
                          fineAmount: Number(e.target.value),
                        })
                      }
                      className="w-full px-3 py-2 border border-border rounded-lg bg-background text-sm"
                    />
                  </div>
                </div>
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-2 bg-secondary hover:bg-secondary/95 text-white font-semibold text-xs rounded-lg transition-colors"
                >
                  {loading ? "Processing return..." : "Confirm Book Return"}
                </button>
              </form>
            </div>
          </div>
        </div>
      )}

      {activeTab === "books" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-4">
            <div className="relative max-w-sm flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search catalog by title, author, category..."
                value={bookSearch}
                onChange={(e) => setBookSearch(e.target.value)}
                className="w-full pl-9 pr-4 py-2 border border-border rounded-xl bg-card text-xs focus:outline-none"
              />
            </div>
            <button
              onClick={() => setBookModalOpen(true)}
              className="px-4 py-2 bg-primary hover:bg-primary/95 text-white text-xs font-semibold rounded-xl flex items-center gap-2 shadow-sm"
            >
              <Plus className="w-4 h-4" /> Add Book to Catalog
            </button>
          </div>

          <div className="bg-card border border-border rounded-xl overflow-hidden shadow-sm">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-muted/40 border-b border-border text-xs text-muted-foreground font-semibold">
                  <th className="p-4">Title & Author</th>
                  <th className="p-4">Category / Subject</th>
                  <th className="p-4">Copies (Avail/Total)</th>
                  <th className="p-4">Rack Location</th>
                  <th className="p-4">Copies Barcodes</th>
                </tr>
              </thead>
              <tbody className="text-sm divide-y divide-border">
                {booksList
                  .filter(
                    (b) =>
                      b.title
                        .toLowerCase()
                        .includes(bookSearch.toLowerCase()) ||
                      b.author
                        .toLowerCase()
                        .includes(bookSearch.toLowerCase()) ||
                      (b.category &&
                        b.category
                          .toLowerCase()
                          .includes(bookSearch.toLowerCase())),
                  )
                  .map((b) => (
                    <tr key={b.id} className="hover:bg-muted/10">
                      <td className="p-4">
                        <p className="font-semibold text-gray-900 dark:text-white">
                          {b.title}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {b.author}
                        </p>
                      </td>
                      <td className="p-4">
                        <span className="text-xs bg-muted text-foreground px-2.5 py-1 rounded-full font-medium">
                          {b.category || "General"}
                        </span>
                      </td>
                      <td className="p-4">
                        <span className="font-bold text-primary">
                          {b.availableCopies}
                        </span>{" "}
                        / {b.totalCopies}
                      </td>
                      <td className="p-4 text-xs font-medium">
                        {b.rackLocation || "Not specified"}
                      </td>
                      <td className="p-4">
                        <div className="flex flex-wrap gap-1.5 max-w-xs">
                          {b.copies.map((c) => (
                            <span
                              key={c.id}
                              className={`text-[10px] px-2 py-0.5 rounded font-semibold border ${
                                c.isAvailable
                                  ? "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/20 dark:text-emerald-400 dark:border-emerald-900"
                                  : "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/20 dark:text-amber-400 dark:border-amber-900"
                              }`}
                              title={`Condition: ${c.condition}`}
                            >
                              {c.barcodeNumber}
                            </span>
                          ))}
                        </div>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === "members" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-4">
            <div className="relative max-w-sm flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search registered members by name or card..."
                value={memberSearch}
                onChange={(e) => setMemberSearch(e.target.value)}
                className="w-full pl-9 pr-4 py-2 border border-border rounded-xl bg-card text-xs focus:outline-none"
              />
            </div>
            <button
              onClick={() => setMemberModalOpen(true)}
              className="px-4 py-2 bg-primary hover:bg-primary/95 text-white text-xs font-semibold rounded-xl flex items-center gap-2 shadow-sm"
            >
              <UserPlus className="w-4 h-4" /> Register New Member
            </button>
          </div>

          <div className="bg-card border border-border rounded-xl overflow-hidden shadow-sm">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-muted/40 border-b border-border text-xs text-muted-foreground font-semibold">
                  <th className="p-4">Card Number</th>
                  <th className="p-4">Member Name</th>
                  <th className="p-4">Role / Type</th>
                  <th className="p-4">Checkout Limit</th>
                  <th className="p-4">Loan Period</th>
                </tr>
              </thead>
              <tbody className="text-sm divide-y divide-border">
                {membersList
                  .filter(
                    (m) =>
                      m.name
                        .toLowerCase()
                        .includes(memberSearch.toLowerCase()) ||
                      m.memberCardNumber
                        .toLowerCase()
                        .includes(memberSearch.toLowerCase()),
                  )
                  .map((m) => (
                    <tr key={m.id} className="hover:bg-muted/10">
                      <td className="p-4 font-mono font-bold text-primary text-xs">
                        {m.memberCardNumber}
                      </td>
                      <td className="p-4 font-medium text-gray-900 dark:text-white">
                        {m.name}
                      </td>
                      <td className="p-4">
                        <span className="text-xs bg-secondary/10 text-secondary px-2.5 py-1 rounded-full font-medium">
                          {m.memberType}
                        </span>
                      </td>
                      <td className="p-4">{m.maxBooksAllowed} books max</td>
                      <td className="p-4 text-xs font-medium text-muted-foreground">
                        {m.loanPeriodDays} days
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === "transactions" && (
        <div className="bg-card border border-border rounded-xl overflow-hidden shadow-sm">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-muted/40 border-b border-border text-xs text-muted-foreground font-semibold">
                <th className="p-4">Barcode / Title</th>
                <th className="p-4">Member Name (Card)</th>
                <th className="p-4">Checkout Date</th>
                <th className="p-4">Due Date</th>
                <th className="p-4">Returned Date</th>
                <th className="p-4">Status</th>
              </tr>
            </thead>
            <tbody className="text-sm divide-y divide-border">
              {issuesList.map((i) => (
                <tr key={i.id} className="hover:bg-muted/10">
                  <td className="p-4">
                    <p className="font-mono text-xs font-semibold text-primary">
                      {i.barcodeNumber}
                    </p>
                    <p className="text-xs text-muted-foreground">{i.title}</p>
                  </td>
                  <td className="p-4">
                    <p className="font-semibold">{i.memberName}</p>
                    <p className="text-xs text-muted-foreground font-mono">
                      {i.memberCardNumber}
                    </p>
                  </td>
                  <td className="p-4 text-xs font-medium">
                    {new Date(i.issuedAt).toLocaleDateString()}
                  </td>
                  <td className="p-4 text-xs font-medium">
                    {new Date(i.dueDate).toLocaleDateString()}
                  </td>
                  <td className="p-4 text-xs font-medium">
                    {i.returnedAt
                      ? new Date(i.returnedAt).toLocaleDateString()
                      : "-"}
                  </td>
                  <td className="p-4">
                    <span
                      className={`text-xs px-2 py-0.5 rounded font-semibold ${
                        i.status === "RETURNED"
                          ? "bg-emerald-100 text-emerald-800"
                          : "bg-amber-100 text-amber-800"
                      }`}
                    >
                      {i.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal: Add Book */}
      {bookModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <form
            onSubmit={handleAddBook}
            className="bg-card border border-border w-full max-w-lg rounded-2xl p-6 space-y-4 shadow-glass animate-fade-in"
          >
            <h3 className="text-lg font-bold text-gray-900 dark:text-white">
              Register New Book Volume
            </h3>

            {errorMsg && (
              <div className="bg-danger/10 border border-danger/30 rounded-xl p-3 text-xs text-danger">
                {errorMsg}
              </div>
            )}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-muted-foreground mb-1">
                  Book Title
                </label>
                <input
                  type="text"
                  required
                  value={newBook.title}
                  onChange={(e) =>
                    setNewBook({ ...newBook, title: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-border bg-background rounded-lg text-sm"
                  placeholder="e.g. Intro to Algorithms"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-muted-foreground mb-1">
                  Author Name
                </label>
                <input
                  type="text"
                  required
                  value={newBook.author}
                  onChange={(e) =>
                    setNewBook({ ...newBook, author: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-border bg-background rounded-lg text-sm"
                  placeholder="e.g. Thomas H. Cormen"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-muted-foreground mb-1">
                  Category
                </label>
                <input
                  type="text"
                  value={newBook.category}
                  onChange={(e) =>
                    setNewBook({ ...newBook, category: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-border bg-background rounded-lg text-sm"
                  placeholder="e.g. Reference"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-muted-foreground mb-1">
                  Subject
                </label>
                <input
                  type="text"
                  value={newBook.subject}
                  onChange={(e) =>
                    setNewBook({ ...newBook, subject: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-border bg-background rounded-lg text-sm"
                  placeholder="e.g. Computer Science"
                />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-semibold text-muted-foreground mb-1">
                  Edition
                </label>
                <input
                  type="text"
                  value={newBook.edition}
                  onChange={(e) =>
                    setNewBook({ ...newBook, edition: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-border bg-background rounded-lg text-sm"
                  placeholder="4th"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-muted-foreground mb-1">
                  Rack Location
                </label>
                <input
                  type="text"
                  value={newBook.rackLocation}
                  onChange={(e) =>
                    setNewBook({ ...newBook, rackLocation: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-border bg-background rounded-lg text-sm"
                  placeholder="Rack A-3"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-muted-foreground mb-1">
                  Copies count
                </label>
                <input
                  type="number"
                  min="1"
                  max="50"
                  required
                  value={newBook.copiesCount}
                  onChange={(e) =>
                    setNewBook({
                      ...newBook,
                      copiesCount: Number(e.target.value),
                    })
                  }
                  className="w-full px-3 py-2 border border-border bg-background rounded-lg text-sm"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setBookModalOpen(false)}
                className="px-4 py-2 text-xs font-semibold border border-border rounded-lg hover:bg-muted"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className="px-4 py-2 bg-primary text-white text-xs font-semibold rounded-lg hover:bg-primary/95"
              >
                {loading ? "Saving..." : "Catalog Book"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Modal: Register Member */}
      {memberModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <form
            onSubmit={handleRegisterMember}
            className="bg-card border border-border w-full max-w-md rounded-2xl p-6 space-y-4 shadow-glass animate-fade-in"
          >
            <h3 className="text-lg font-bold text-gray-900 dark:text-white">
              Register Library Member Card
            </h3>
            <div>
              <label className="block text-xs font-semibold text-muted-foreground mb-1">
                Member Role / Type
              </label>
              <select
                value={newMember.memberType}
                onChange={(e) =>
                  setNewMember({
                    ...newMember,
                    memberType: e.target.value as "STUDENT" | "STAFF",
                    memberRefId: "", // Reset RefId on role toggle to avoid mismatched foreign keys
                  })
                }
                className="w-full px-3 py-2 border border-border bg-background rounded-lg text-sm"
              >
                <option value="STUDENT">Student</option>
                <option value="STAFF">Teacher / Staff</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-muted-foreground mb-1">
                Select school Person
              </label>
              <select
                required
                value={newMember.memberRefId}
                onChange={(e) =>
                  setNewMember({ ...newMember, memberRefId: e.target.value })
                }
                className="w-full px-3 py-2 border border-border bg-background rounded-lg text-sm"
              >
                <option value="">-- Select Person --</option>
                {newMember.memberType === "STUDENT"
                  ? studentsList.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name} (Student)
                      </option>
                    ))
                  : staffList.map((st) => (
                      <option key={st.id} value={st.id}>
                        {st.name} (Staff)
                      </option>
                    ))}
              </select>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div className="col-span-2">
                <label className="block text-xs font-semibold text-muted-foreground mb-1">
                  Library Card Number
                </label>
                <input
                  type="text"
                  required
                  value={newMember.memberCardNumber}
                  onChange={(e) =>
                    setNewMember({
                      ...newMember,
                      memberCardNumber: e.target.value,
                    })
                  }
                  className="w-full px-3 py-2 border border-border bg-background rounded-lg text-sm"
                  placeholder="e.g. LIB-ST-1002"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-muted-foreground mb-1">
                  Loan Days
                </label>
                <input
                  type="number"
                  required
                  value={newMember.loanPeriodDays}
                  onChange={(e) =>
                    setNewMember({
                      ...newMember,
                      loanPeriodDays: Number(e.target.value),
                    })
                  }
                  className="w-full px-3 py-2 border border-border bg-background rounded-lg text-sm"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setMemberModalOpen(false)}
                className="px-4 py-2 text-xs font-semibold border border-border rounded-lg hover:bg-muted"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className="px-4 py-2 bg-primary text-white text-xs font-semibold rounded-lg hover:bg-primary/95"
              >
                {loading ? "Registering..." : "Assign Library Card"}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
