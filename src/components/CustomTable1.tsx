import React from "react";
import {
  type ColumnDef,
  flexRender,
  getCoreRowModel,
  getFacetedRowModel,
  getFacetedUniqueValues,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  ChevronDownIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ChevronsLeftIcon,
  ChevronsRightIcon,
  ColumnsIcon,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import PropTypes from "prop-types";
import { Card } from "./ui/card";
import { cn } from "@/lib/utils";

export interface CustomTable1Props<TData = any> {
  data: TData[];
  columns: ColumnDef<TData, any>[];
  filter?: boolean;
  selection?: boolean;
  loading?: boolean;
  pagination?: boolean;
  card?: boolean;
}

export default function CustomTable1<TData = any>({
  data: initialData,
  columns,
  filter = false,
  selection = false,
  loading = false,
  pagination: showPagination = true,
  card = false,
}: CustomTable1Props<TData>) {
  const [rowSelection, setRowSelection] = React.useState({});
  const [columnVisibility, setColumnVisibility] = React.useState({});
  const [columnFilters, setColumnFilters] = React.useState<any[]>([]);
  const [sorting, setSorting] = React.useState<any[]>([]);
  const [pagination, setPagination] = React.useState({
    pageIndex: 0,
    pageSize: 50,
  });

  const table = useReactTable({
    data: initialData,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getFacetedRowModel: getFacetedRowModel(),
    getFacetedUniqueValues: getFacetedUniqueValues(),
    enableRowSelection: selection,
    state: {
      rowSelection,
      columnVisibility,
      columnFilters,
      sorting,
      pagination,
    },
    onRowSelectionChange: setRowSelection,
    onColumnVisibilityChange: setColumnVisibility,
    onColumnFiltersChange: setColumnFilters,
    onSortingChange: setSorting,
    onPaginationChange: setPagination,
  });

  const renderPagination = (isMobile = false) => {
    if (!showPagination) return null;
    return (
      <div
        className={cn(
          selection ? "justify-between" : "justify-end",
          "flex items-center p-3 border-t border-zinc-200/80 bg-zinc-50/40 text-xs text-zinc-600 dark:border-zinc-800 dark:bg-zinc-900/40 dark:text-zinc-400"
        )}
      >
        {selection && (
          <div className="hidden flex-1 text-sm text-slate-500 lg:flex dark:text-slate-400">
            {table.getFilteredSelectedRowModel().rows.length} of{" "}
            {table.getFilteredRowModel().rows.length} row(s) selected.
          </div>
        )}
        <div className="flex w-full items-center gap-4 lg:gap-8 lg:w-fit justify-between lg:justify-end">
          <div className="hidden items-center gap-2 lg:flex">
            <Label htmlFor="rows-per-page" className="text-sm font-medium">
              Rows per page
            </Label>
            <Select
              value={`${table.getState().pagination.pageSize}`}
              onValueChange={(value) => {
                table.setPageSize(Number(value));
              }}
            >
              <SelectTrigger className="w-20" id={isMobile ? "rows-per-page-mobile" : "rows-per-page"}>
                <SelectValue
                  placeholder={table.getState().pagination.pageSize}
                />
              </SelectTrigger>
              <SelectContent side="top">
                {[10, 25, 50, 100].map((pageSize) => (
                  <SelectItem key={pageSize} value={`${pageSize}`}>
                    {pageSize}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex w-fit items-center justify-center text-xs sm:text-sm font-medium">
            Page {table.getState().pagination.pageIndex + 1} of{" "}
            {Math.max(1, table.getPageCount())}
          </div>
          <div className="flex items-center gap-1.5 sm:gap-2">
            <Button
              variant="outline"
              className="hidden h-8 w-8 p-0 lg:flex"
              onClick={() => table.setPageIndex(0)}
              disabled={!table.getCanPreviousPage()}
            >
              <span className="sr-only">Go to first page</span>
              <ChevronsLeftIcon className="size-4" />
            </Button>
            <Button
              variant="outline"
              className="size-8"
              size="icon"
              onClick={() => table.previousPage()}
              disabled={!table.getCanPreviousPage()}
            >
              <span className="sr-only">Go to previous page</span>
              <ChevronLeftIcon className="size-4" />
            </Button>
            <Button
              variant="outline"
              className="size-8"
              size="icon"
              onClick={() => table.nextPage()}
              disabled={!table.getCanNextPage()}
            >
              <span className="sr-only">Go to next page</span>
              <ChevronRightIcon className="size-4" />
            </Button>
            <Button
              variant="outline"
              className="hidden size-8 lg:flex"
              size="icon"
              onClick={() => table.setPageIndex(table.getPageCount() - 1)}
              disabled={!table.getCanNextPage()}
            >
              <span className="sr-only">Go to last page</span>
              <ChevronsRightIcon className="size-4" />
            </Button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="p-0">
      {filter && (
        <div className="flex items-center justify-end gap-2 my-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                <ColumnsIcon />
                <span className="hidden lg:inline">Customize Columns</span>
                <span className="lg:hidden">Columns</span>
                <ChevronDownIcon />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              {table
                .getAllColumns()
                .filter(
                  (column) =>
                    typeof column.id !== "undefined" && column.getCanHide()
                )
                .map((column) => {
                  return (
                    <DropdownMenuCheckboxItem
                      key={column.id}
                      className="capitalize"
                      checked={column.getIsVisible()}
                      onCheckedChange={(value) =>
                        column.toggleVisibility(!!value)
                      }
                    >
                      {String(column.columnDef.header || column.id)}
                    </DropdownMenuCheckboxItem>
                  );
                })}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      )}

      {/* Mobile Card View: active only when card={true} on viewports below md */}
      {card && (
        <div className="md:hidden space-y-3">
          {loading && (
            <div className="p-8 text-center rounded-2xl border border-zinc-200/90 dark:border-zinc-800 bg-white dark:bg-zinc-950 shadow-xs">
              <Loader2 className="animate-spin inline-block size-5 text-zinc-500" />
            </div>
          )}
          {!loading && (table.getRowModel().rows?.length ? (
            table.getRowModel().rows.map((row) => (
              <div
                key={row.id}
                className="rounded-2xl border border-zinc-200/90 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-4 shadow-xs space-y-2.5"
              >
                {row.getVisibleCells().map((cell) => {
                  if (cell.column.id === "actions" || cell.column.id === "action") {
                    return (
                      <div
                        key={cell.id}
                        className="pt-2 mt-1 border-t border-zinc-100 dark:border-zinc-800/60 flex items-center justify-end gap-2"
                      >
                        {flexRender(
                          cell.column.columnDef.cell,
                          cell.getContext()
                        )}
                      </div>
                    );
                  }

                  const headerGroup = table.getHeaderGroups()[0];
                  const matchingHeader = headerGroup?.headers.find(
                    (h) => h.column.id === cell.column.id
                  );
                  const headerTitle = matchingHeader
                    ? flexRender(
                        matchingHeader.column.columnDef.header,
                        matchingHeader.getContext()
                      )
                    : typeof cell.column.columnDef.header === "string"
                    ? cell.column.columnDef.header
                    : String(cell.column.id);

                  return (
                    <div
                      key={cell.id}
                      className="flex items-center justify-between gap-3 py-1 border-b border-zinc-100 dark:border-zinc-800/60 last:border-0 text-xs"
                    >
                      <span className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider shrink-0 [&_button]:h-auto [&_button]:p-0 [&_button]:text-[11px] [&_button]:font-bold [&_button]:text-zinc-400 [&_button]:uppercase [&_button]:tracking-wider [&_button]:hover:bg-transparent">
                        {headerTitle}
                      </span>
                      <div className="text-right min-w-0 flex-1 flex justify-end">
                        {flexRender(
                          cell.column.columnDef.cell,
                          cell.getContext()
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            ))
          ) : (
            <div className="p-8 text-center text-xs text-zinc-400 rounded-2xl border border-zinc-200/90 dark:border-zinc-800 bg-white dark:bg-zinc-950 shadow-xs">
              No results found.
            </div>
          ))}

          {/* Pagination for mobile cards */}
          {showPagination && (
            <Card className="p-0 overflow-hidden border border-zinc-200/80 shadow-xs">
              {renderPagination(true)}
            </Card>
          )}
        </div>
      )}

      {/* Desktop/Standard Table */}
      <Card
        className={cn(
          "p-0 overflow-hidden border border-zinc-200/80 shadow-xs",
          card && "hidden md:block"
        )}
      >
        <Table className="w-full">
          <TableHeader className="bg-zinc-50/90 border-b border-zinc-200/80 dark:bg-zinc-900/90 dark:border-zinc-800">
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow
                key={headerGroup.id}
                className="border-b border-zinc-200/80 dark:border-zinc-800 hover:bg-transparent"
              >
                {headerGroup.headers.map((header) => {
                  return (
                    <TableHead
                      key={header.id}
                      colSpan={header.colSpan}
                      className="h-10 px-4 py-2.5 text-left align-middle text-xs font-semibold text-zinc-600 dark:text-zinc-300 whitespace-nowrap"
                    >
                      {header.isPlaceholder
                        ? null
                        : flexRender(
                            header.column.columnDef.header,
                            header.getContext()
                          )}
                    </TableHead>
                  );
                })}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {loading && (
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className="h-24 text-center"
                >
                  <Loader2 className="animate-spin inline-block size-5 text-zinc-500" />
                </TableCell>
              </TableRow>
            )}
            {!loading &&
              (table.getRowModel().rows?.length ? (
                table.getRowModel().rows.map((row) => (
                  <TableRow
                    key={row.id}
                    className="border-b border-zinc-100 dark:border-zinc-800 transition-colors hover:bg-zinc-50/60 dark:hover:bg-zinc-900/50"
                  >
                    {row.getVisibleCells().map((cell) => (
                      <TableCell
                        key={cell.id}
                        className="px-4 py-3 text-xs text-zinc-700 dark:text-zinc-200 align-middle"
                      >
                        {flexRender(
                          cell.column.columnDef.cell,
                          cell.getContext()
                        )}
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell
                    colSpan={columns.length}
                    className="h-24 text-center text-xs text-zinc-400"
                  >
                    No results found.
                  </TableCell>
                </TableRow>
              ))}
          </TableBody>
        </Table>

        {renderPagination(false)}
      </Card>
    </div>
  );
}

CustomTable1.propTypes = {
  data: PropTypes.array.isRequired,
  columns: PropTypes.array.isRequired,
  filter: PropTypes.bool,
  selection: PropTypes.bool,
  loading: PropTypes.bool,
  pagination: PropTypes.bool,
  card: PropTypes.bool,
};
