import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
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
};

export function SchoolDepartmentPicker({
  schoolValue, departmentValue, onSchoolChange, onDepartmentChange,
  schoolName = "school", departmentName = "department",
  required, layout = "stacked", includeEmpty,
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

  // Clear department if it no longer belongs to selected school
  useEffect(() => {
    if (!schoolId) {
      if (departmentValue) onDepartmentChange("");
      return;
    }
    if (departmentValue && !departments.some((d) => d.name === departmentValue)) {
      onDepartmentChange("");
    }
  }, [schoolId, departments]);

  const SENTINEL = "__none__";

  const schoolSelect = (
    <div className="space-y-1.5">
      <Label>School{required && " *"}</Label>
      <Select
        value={schoolValue || (includeEmpty ? SENTINEL : undefined)}
        onValueChange={(v) => onSchoolChange(v === SENTINEL ? "" : v)}
      >
        <SelectTrigger><SelectValue placeholder="Select school" /></SelectTrigger>
        <SelectContent>
          {includeEmpty && <SelectItem value={SENTINEL}>{includeEmpty.label}</SelectItem>}
          {schools.length === 0 ? (
            <div className="px-3 py-2 text-xs text-muted-foreground">No schools yet — ask an admin.</div>
          ) : schools.map((s) => (
            <SelectItem key={s.id} value={s.name}>{s.name}</SelectItem>
          ))}
        </SelectContent>
      </Select>
      <input type="hidden" name={schoolName} value={schoolValue} />
    </div>
  );

  const deptSelect = (
    <div className="space-y-1.5">
      <Label>Department{required && " *"}</Label>
      <Select
        value={departmentValue || (includeEmpty ? SENTINEL : undefined)}
        onValueChange={(v) => onDepartmentChange(v === SENTINEL ? "" : v)}
        disabled={!schoolId}
      >
        <SelectTrigger><SelectValue placeholder={schoolId ? "Select department" : "Select school first"} /></SelectTrigger>
        <SelectContent>
          {includeEmpty && <SelectItem value={SENTINEL}>{includeEmpty.label}</SelectItem>}
          {departments.length === 0 ? (
            <div className="px-3 py-2 text-xs text-muted-foreground">No departments listed.</div>
          ) : departments.map((d) => (
            <SelectItem key={d.id} value={d.name}>{d.name}</SelectItem>
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
