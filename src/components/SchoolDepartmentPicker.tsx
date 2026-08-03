import { useEffect, useRef } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { listSchools, listDepartments } from "@/lib/lookups.functions";

type Props = {
  schoolValue: string;
  departmentValue: string;
  onSchoolChange: (name: string) => void;
  onDepartmentChange: (name: string) => void;
  schoolName?: string;
  departmentName?: string;
  required?: boolean;
  layout?: "stacked" | "grid";
  includeEmpty?: { label: string };
  /** Lock the school select (e.g. 6-month change cooldown). Value stays visible. */
  schoolDisabled?: boolean;
  schoolHint?: React.ReactNode;
};

export function SchoolDepartmentPicker({
  schoolValue, departmentValue, onSchoolChange, onDepartmentChange,
  schoolName = "school", departmentName = "department",
  required, layout = "stacked", includeEmpty,
  schoolDisabled, schoolHint,
}: Props) {
  const schoolsFn = useServerFn(listSchools);
  const deptsFn = useServerFn(listDepartments);

  const { data: schoolsData } = useQuery({
    queryKey: ["lookup-schools"],
    queryFn: () => schoolsFn(),
  });
  const schools = schoolsData?.schools ?? [];

  const selectedSchool = schools.find((s) => s.name === schoolValue);
  const schoolId = selectedSchool?.id;

  const { data: deptsData } = useQuery({
    queryKey: ["lookup-departments", schoolId ?? "none"],
    queryFn: () => deptsFn({ data: schoolId ? { schoolId } : {} }),
    enabled: !!schoolId,
  });
  const departments = deptsData?.departments ?? [];

  // Only clear the department when the user actually switches school — never
  // during loading/hydration, otherwise a saved department gets wiped.
  const lastSchool = useRef<string | null>(null);
  useEffect(() => {
    if (lastSchool.current === null) {
      lastSchool.current = schoolValue;
      return;
    }
    if (lastSchool.current !== schoolValue) {
      lastSchool.current = schoolValue;
      if (departmentValue) onDepartmentChange("");
    }
  }, [schoolValue, departmentValue, onDepartmentChange]);

  const SENTINEL = "__none__";
  const deptOptions = departments.map((d) => d.name);
  // Keep a persisted department visible even if it isn't in the lookup list.
  if (departmentValue && !deptOptions.includes(departmentValue)) deptOptions.unshift(departmentValue);
  const schoolOptions = schools.map((s) => s.name);
  if (schoolValue && !schoolOptions.includes(schoolValue)) schoolOptions.unshift(schoolValue);

  const schoolSelect = (
    <div className="space-y-1.5">
      <Label>School{required && " *"}</Label>
      <Select
        value={schoolValue || (includeEmpty ? SENTINEL : undefined)}
        onValueChange={(v) => onSchoolChange(v === SENTINEL ? "" : v)}
        disabled={schoolDisabled}
      >
        <SelectTrigger><SelectValue placeholder="Select school" /></SelectTrigger>
        <SelectContent>
          {includeEmpty && <SelectItem value={SENTINEL}>{includeEmpty.label}</SelectItem>}
          {schoolOptions.length === 0 ? (
            <div className="px-3 py-2 text-xs text-muted-foreground">No schools yet — ask an admin.</div>
          ) : schoolOptions.map((name) => (
            <SelectItem key={name} value={name}>{name}</SelectItem>
          ))}
        </SelectContent>
      </Select>
      {schoolHint}
      <input type="hidden" name={schoolName} value={schoolValue} />
    </div>
  );

  const deptSelect = (
    <div className="space-y-1.5">
      <Label>Department{required && " *"}</Label>
      <Select
        value={departmentValue || (includeEmpty ? SENTINEL : undefined)}
        onValueChange={(v) => onDepartmentChange(v === SENTINEL ? "" : v)}
        disabled={!schoolValue}
      >
        <SelectTrigger><SelectValue placeholder={schoolValue ? "Select department" : "Select school first"} /></SelectTrigger>
        <SelectContent>
          {includeEmpty && <SelectItem value={SENTINEL}>{includeEmpty.label}</SelectItem>}
          {deptOptions.length === 0 ? (
            <div className="px-3 py-2 text-xs text-muted-foreground">No departments listed.</div>
          ) : deptOptions.map((name) => (
            <SelectItem key={name} value={name}>{name}</SelectItem>
          ))}
        </SelectContent>
      </Select>
      <input type="hidden" name={departmentName} value={departmentValue} />
    </div>
  );

  if (layout === "grid") {
    return <div className="grid sm:grid-cols-2 gap-3">{schoolSelect}{deptSelect}</div>;
  }
  return <>{schoolSelect}{deptSelect}</>;
}

