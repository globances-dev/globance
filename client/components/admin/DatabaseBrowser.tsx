import { useState, useEffect } from "react";
import { useToast } from "../../hooks/use-toast";
import { tokenManager } from "../../lib/api";
import {
  Database,
  Table,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  Edit2,
  Trash2,
  Save,
  X,
  Search,
  Terminal,
  Play,
} from "lucide-react";

interface TableInfo {
  name: string;
  columns: number;
  rows: number;
}

interface ColumnInfo {
  name: string;
  type: string;
  nullable: boolean;
  default: string | null;
  maxLength: number | null;
  isPrimaryKey: boolean;
}

interface TableData {
  table: string;
  data: Record<string, any>[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export default function DatabaseBrowser() {
  const { toast } = useToast();
  const [tables, setTables] = useState<TableInfo[]>([]);
  const [selectedTable, setSelectedTable] = useState<string | null>(null);
  const [tableSchema, setTableSchema] = useState<ColumnInfo[]>([]);
  const [tableData, setTableData] = useState<TableData | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingData, setLoadingData] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [editingRow, setEditingRow] = useState<Record<string, any> | null>(null);
  const [editedValues, setEditedValues] = useState<Record<string, any>>({});
  const [searchQuery, setSearchQuery] = useState("");
  const [showQueryPanel, setShowQueryPanel] = useState(false);
  const [customQuery, setCustomQuery] = useState("");
  const [queryResult, setQueryResult] = useState<any>(null);
  const [runningQuery, setRunningQuery] = useState(false);

  useEffect(() => {
    fetchTables();
  }, []);

  useEffect(() => {
    if (selectedTable) {
      fetchTableSchema(selectedTable);
      fetchTableData(selectedTable, 1);
    }
  }, [selectedTable]);

  const fetchTables = async () => {
    try {
      setLoading(true);
      const token = tokenManager.getToken();

      const response = await fetch("/api/admin/db/tables", {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.ok) {
        const data = await response.json();
        setTables(data.tables || []);
      } else {
        const error = await response.json();
        toast({
          title: "Error",
          description: error.error || "Failed to load tables",
          variant: "destructive",
        });
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchTableSchema = async (tableName: string) => {
    try {
      const token = tokenManager.getToken();

      const response = await fetch(`/api/admin/db/tables/${tableName}/schema`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.ok) {
        const data = await response.json();
        setTableSchema(data.columns || []);
      }
    } catch (error: any) {
      console.error("Failed to fetch schema:", error);
    }
  };

  const fetchTableData = async (tableName: string, page: number) => {
    try {
      setLoadingData(true);
      const token = tokenManager.getToken();

      const response = await fetch(
        `/api/admin/db/tables/${tableName}/data?page=${page}&limit=25`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      if (response.ok) {
        const data = await response.json();
        setTableData(data);
        setCurrentPage(page);
      }
    } catch (error: any) {
      console.error("Failed to fetch data:", error);
    } finally {
      setLoadingData(false);
    }
  };

  const handleEditRow = (row: Record<string, any>) => {
    setEditingRow(row);
    setEditedValues({ ...row });
  };

  const handleSaveRow = async () => {
    if (!editingRow || !selectedTable) return;

    const primaryKeyCol = tableSchema.find((c) => c.isPrimaryKey);
    if (!primaryKeyCol) {
      toast({
        title: "Error",
        description: "Cannot find primary key for this table",
        variant: "destructive",
      });
      return;
    }

    const updates: Record<string, any> = {};
    for (const key of Object.keys(editedValues)) {
      if (editedValues[key] !== editingRow[key] && key !== primaryKeyCol.name) {
        updates[key] = editedValues[key];
      }
    }

    if (Object.keys(updates).length === 0) {
      setEditingRow(null);
      return;
    }

    try {
      const token = tokenManager.getToken();

      const response = await fetch(`/api/admin/db/tables/${selectedTable}/row`, {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          primaryKey: primaryKeyCol.name,
          primaryKeyValue: editingRow[primaryKeyCol.name],
          updates,
        }),
      });

      if (response.ok) {
        toast({
          title: "Success",
          description: "Row updated successfully",
        });
        setEditingRow(null);
        fetchTableData(selectedTable, currentPage);
      } else {
        const error = await response.json();
        toast({
          title: "Error",
          description: error.error || "Failed to update row",
          variant: "destructive",
        });
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleDeleteRow = async (row: Record<string, any>) => {
    if (!selectedTable) return;

    const primaryKeyCol = tableSchema.find((c) => c.isPrimaryKey);
    if (!primaryKeyCol) {
      toast({
        title: "Error",
        description: "Cannot find primary key for this table",
        variant: "destructive",
      });
      return;
    }

    if (
      !confirm(
        `Are you sure you want to delete this row? This action cannot be undone.`
      )
    ) {
      return;
    }

    try {
      const token = tokenManager.getToken();

      const response = await fetch(`/api/admin/db/tables/${selectedTable}/row`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          primaryKey: primaryKeyCol.name,
          primaryKeyValue: row[primaryKeyCol.name],
        }),
      });

      if (response.ok) {
        toast({
          title: "Success",
          description: "Row deleted successfully",
        });
        fetchTableData(selectedTable, currentPage);
      } else {
        const error = await response.json();
        toast({
          title: "Error",
          description: error.error || "Failed to delete row",
          variant: "destructive",
        });
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleRunQuery = async () => {
    if (!customQuery.trim()) return;

    try {
      setRunningQuery(true);
      const token = tokenManager.getToken();

      const response = await fetch("/api/admin/db/query", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ sql: customQuery }),
      });

      const data = await response.json();

      if (response.ok) {
        setQueryResult(data);
        toast({
          title: "Query executed",
          description: `${data.rowCount || 0} rows affected`,
        });
      } else {
        toast({
          title: "Query Error",
          description: data.error,
          variant: "destructive",
        });
        setQueryResult({ error: data.error });
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setRunningQuery(false);
    }
  };

  const formatCellValue = (value: any): string => {
    if (value === null) return "NULL";
    if (value === undefined) return "";
    if (typeof value === "object") return JSON.stringify(value);
    if (typeof value === "boolean") return value ? "true" : "false";
    return String(value);
  };

  const filteredTables = tables.filter((t) =>
    t.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <RefreshCw className="animate-spin text-primary mr-2" size={24} />
        <span>Loading production database...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Database className="text-primary" size={28} />
            Production Database
          </h2>
          <p className="text-muted-foreground text-sm mt-1">
            View and edit data in the production database (globance_prod)
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowQueryPanel(!showQueryPanel)}
            className={`px-4 py-2 rounded-lg flex items-center gap-2 transition-colors ${
              showQueryPanel
                ? "bg-primary text-primary-foreground"
                : "bg-secondary hover:bg-secondary/80"
            }`}
          >
            <Terminal size={16} />
            SQL Query
          </button>
          <button
            onClick={fetchTables}
            className="px-4 py-2 bg-secondary hover:bg-secondary/80 rounded-lg flex items-center gap-2"
          >
            <RefreshCw size={16} />
            Refresh
          </button>
        </div>
      </div>

      {showQueryPanel && (
        <div className="card-gradient border border-border rounded-lg p-4 space-y-4">
          <div className="flex items-center gap-2 mb-2">
            <Terminal className="text-primary" size={20} />
            <h3 className="font-semibold">Custom SQL Query</h3>
          </div>
          <textarea
            value={customQuery}
            onChange={(e) => setCustomQuery(e.target.value)}
            placeholder="SELECT * FROM users LIMIT 10;"
            className="w-full h-32 bg-background border border-border rounded-lg p-3 font-mono text-sm"
          />
          <div className="flex justify-between items-center">
            <p className="text-xs text-muted-foreground">
              Note: DROP, TRUNCATE, and ALTER commands are blocked for safety
            </p>
            <button
              onClick={handleRunQuery}
              disabled={runningQuery || !customQuery.trim()}
              className="px-4 py-2 bg-primary text-primary-foreground rounded-lg flex items-center gap-2 disabled:opacity-50"
            >
              {runningQuery ? (
                <RefreshCw className="animate-spin" size={16} />
              ) : (
                <Play size={16} />
              )}
              Execute
            </button>
          </div>

          {queryResult && (
            <div className="mt-4">
              {queryResult.error ? (
                <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-lg text-red-500">
                  {queryResult.error}
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <p className="text-sm text-muted-foreground mb-2">
                    {queryResult.rowCount} rows returned ({queryResult.command})
                  </p>
                  {queryResult.rows && queryResult.rows.length > 0 && (
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-border">
                          {Object.keys(queryResult.rows[0]).map((key) => (
                            <th
                              key={key}
                              className="text-left p-2 font-medium text-muted-foreground"
                            >
                              {key}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {queryResult.rows.slice(0, 100).map((row: any, i: number) => (
                          <tr key={i} className="border-b border-border/50">
                            {Object.values(row).map((val: any, j: number) => (
                              <td key={j} className="p-2 font-mono text-xs">
                                {formatCellValue(val)}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <div className="card-gradient border border-border rounded-lg p-4">
          <div className="flex items-center gap-2 mb-4">
            <Table className="text-primary" size={20} />
            <h3 className="font-semibold">Tables ({tables.length})</h3>
          </div>

          <div className="relative mb-4">
            <Search
              className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
              size={16}
            />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search tables..."
              className="w-full pl-10 pr-4 py-2 bg-background border border-border rounded-lg text-sm"
            />
          </div>

          <div className="space-y-1 max-h-[500px] overflow-y-auto">
            {filteredTables.map((table) => (
              <button
                key={table.name}
                onClick={() => setSelectedTable(table.name)}
                className={`w-full text-left px-3 py-2 rounded-lg transition-colors ${
                  selectedTable === table.name
                    ? "bg-primary text-primary-foreground"
                    : "hover:bg-secondary"
                }`}
              >
                <div className="font-medium text-sm truncate">{table.name}</div>
                <div
                  className={`text-xs ${
                    selectedTable === table.name
                      ? "text-primary-foreground/70"
                      : "text-muted-foreground"
                  }`}
                >
                  {table.rows} rows, {table.columns} columns
                </div>
              </button>
            ))}
          </div>
        </div>

        <div className="lg:col-span-3">
          {selectedTable ? (
            <div className="card-gradient border border-border rounded-lg p-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-lg">{selectedTable}</h3>
                {tableData && (
                  <span className="text-sm text-muted-foreground">
                    {tableData.total} total rows
                  </span>
                )}
              </div>

              {loadingData ? (
                <div className="flex items-center justify-center py-12">
                  <RefreshCw className="animate-spin text-primary" size={24} />
                </div>
              ) : tableData && tableData.data.length > 0 ? (
                <>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-border">
                          {tableSchema.map((col) => (
                            <th
                              key={col.name}
                              className="text-left p-2 font-medium text-muted-foreground whitespace-nowrap"
                            >
                              {col.name}
                              {col.isPrimaryKey && (
                                <span className="ml-1 text-primary text-xs">
                                  (PK)
                                </span>
                              )}
                            </th>
                          ))}
                          <th className="text-left p-2 font-medium text-muted-foreground">
                            Actions
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {tableData.data.map((row, idx) => (
                          <tr
                            key={idx}
                            className="border-b border-border/50 hover:bg-secondary/30"
                          >
                            {tableSchema.map((col) => (
                              <td
                                key={col.name}
                                className="p-2 font-mono text-xs max-w-[200px] truncate"
                              >
                                {editingRow === row ? (
                                  col.isPrimaryKey ? (
                                    formatCellValue(row[col.name])
                                  ) : (
                                    <input
                                      type="text"
                                      value={
                                        editedValues[col.name] === null
                                          ? ""
                                          : editedValues[col.name] ?? ""
                                      }
                                      onChange={(e) =>
                                        setEditedValues({
                                          ...editedValues,
                                          [col.name]:
                                            e.target.value === ""
                                              ? null
                                              : e.target.value,
                                        })
                                      }
                                      className="w-full px-2 py-1 bg-background border border-border rounded text-xs"
                                    />
                                  )
                                ) : (
                                  formatCellValue(row[col.name])
                                )}
                              </td>
                            ))}
                            <td className="p-2">
                              <div className="flex items-center gap-1">
                                {editingRow === row ? (
                                  <>
                                    <button
                                      onClick={handleSaveRow}
                                      className="p-1 text-green-500 hover:bg-green-500/20 rounded"
                                    >
                                      <Save size={14} />
                                    </button>
                                    <button
                                      onClick={() => setEditingRow(null)}
                                      className="p-1 text-red-500 hover:bg-red-500/20 rounded"
                                    >
                                      <X size={14} />
                                    </button>
                                  </>
                                ) : (
                                  <>
                                    <button
                                      onClick={() => handleEditRow(row)}
                                      className="p-1 text-blue-500 hover:bg-blue-500/20 rounded"
                                    >
                                      <Edit2 size={14} />
                                    </button>
                                    <button
                                      onClick={() => handleDeleteRow(row)}
                                      className="p-1 text-red-500 hover:bg-red-500/20 rounded"
                                    >
                                      <Trash2 size={14} />
                                    </button>
                                  </>
                                )}
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {tableData.totalPages > 1 && (
                    <div className="flex items-center justify-between mt-4 pt-4 border-t border-border">
                      <button
                        onClick={() =>
                          fetchTableData(selectedTable, currentPage - 1)
                        }
                        disabled={currentPage <= 1}
                        className="px-3 py-1 bg-secondary hover:bg-secondary/80 rounded disabled:opacity-50 flex items-center gap-1"
                      >
                        <ChevronLeft size={16} />
                        Previous
                      </button>
                      <span className="text-sm text-muted-foreground">
                        Page {currentPage} of {tableData.totalPages}
                      </span>
                      <button
                        onClick={() =>
                          fetchTableData(selectedTable, currentPage + 1)
                        }
                        disabled={currentPage >= tableData.totalPages}
                        className="px-3 py-1 bg-secondary hover:bg-secondary/80 rounded disabled:opacity-50 flex items-center gap-1"
                      >
                        Next
                        <ChevronRight size={16} />
                      </button>
                    </div>
                  )}
                </>
              ) : (
                <div className="text-center py-12 text-muted-foreground">
                  No data in this table
                </div>
              )}
            </div>
          ) : (
            <div className="card-gradient border border-border rounded-lg p-12 text-center">
              <Database className="mx-auto text-muted-foreground mb-4" size={48} />
              <h3 className="text-lg font-semibold mb-2">Select a Table</h3>
              <p className="text-muted-foreground text-sm">
                Choose a table from the list to view and edit its data
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
