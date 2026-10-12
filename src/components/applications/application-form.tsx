"use client";

import { useMemo, useState, useTransition } from "react";
import { Link2, Wand2, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { fetchJobFromUrl, analyzeJob } from "@/lib/actions/analyze";
import { applicationStatusLabels, priorityLabels } from "@/lib/labels";
import type { Application, Employer } from "@/generated/prisma/client";

export interface ExistingApplicationSummary {
  id: string;
  title: string;
  status: string;
  employerName: string;
}

export interface ApplicationFormInitial {
  title?: string;
  company?: string;
  location?: string;
  salary?: string;
  deadline?: string; // ISO date
  description?: string;
  jobUrl?: string;
}

export function ApplicationForm({
  action,
  application,
  employers,
  existingApplications = [],
  initial,
  aiAvailable = false,
}: {
  action: (formData: FormData) => void;
  application?: (Application & { employer: Employer | null }) | null;
  employers: { id: string; name: string }[];
  existingApplications?: ExistingApplicationSummary[];
  initial?: ApplicationFormInitial;
  aiAvailable?: boolean;
}) {
  const initialDeadline = application?.deadline
    ? new Date(application.deadline).toISOString().slice(0, 10)
    : (initial?.deadline ?? "");

  const [jobUrl, setJobUrl] = useState(application?.jobUrl ?? initial?.jobUrl ?? "");
  const [title, setTitle] = useState(application?.title ?? initial?.title ?? "");
  const [company, setCompany] = useState(application?.employer?.name ?? initial?.company ?? "");
  const [location, setLocation] = useState(application?.location ?? initial?.location ?? "");
  const [salary, setSalary] = useState(application?.salary ?? initial?.salary ?? "");
  const [deadline, setDeadline] = useState(initialDeadline);
  const [description, setDescription] = useState(application?.description ?? initial?.description ?? "");
  const [autofilling, startAutofill] = useTransition();

  const duplicateMatches = useMemo(() => {
    const trimmed = company.trim().toLowerCase();
    if (!trimmed) return [];
    return existingApplications.filter((existing) => existing.employerName.trim().toLowerCase() === trimmed);
  }, [company, existingApplications]);

  function handleAutofill() {
    const input = jobUrl.trim();
    const isUrl = /^https?:\/\//i.test(input);
    // Job text pasted into the URL box (or already in the description) is analysed directly,
    // for listings on sites that block the fetch.
    const pastedText = isUrl ? "" : input || description.trim();
    if (!isUrl && !pastedText) {
      toast.error("Paste the job listing URL, or the job description text, first");
      return;
    }
    startAutofill(async () => {
      try {
        const text = isUrl ? (await fetchJobFromUrl(input)).text : pastedText;
        setDescription(text);
        if (!isUrl && input) setJobUrl("");

        if (aiAvailable) {
          const fields = await analyzeJob(text);
          if (fields.title) setTitle(fields.title);
          if (fields.company) setCompany(fields.company);
          if (fields.location) setLocation(fields.location);
          if (fields.salary) setSalary(fields.salary);
          if (fields.deadline) setDeadline(fields.deadline);
          toast.success("Filled in from the job listing. Review before saving.");
        } else {
          toast.success("Pulled the job description. Add an ANTHROPIC_API_KEY to auto-fill the other fields too.");
        }
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Couldn't read that URL");
      }
    });
  }

  return (
    <form action={action} className="grid max-w-2xl gap-4">
      <datalist id="employer-names">
        {employers.map((employer) => (
          <option key={employer.id} value={employer.name} />
        ))}
      </datalist>

      <Card>
        <CardContent className="pt-6">
          <Label htmlFor="autofill-url">Job listing URL or pasted job description</Label>
          <div className="mt-1.5 flex gap-2">
            <div className="relative flex-1">
              <Link2 className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="autofill-url"
                value={jobUrl}
                onChange={(e) => setJobUrl(e.target.value)}
                placeholder="https://company.com/careers/graduate-role"
                className="pl-8"
              />
            </div>
            <Button type="button" variant="outline" disabled={autofilling} onClick={handleAutofill}>
              <Wand2 className="h-4 w-4" />
              {autofilling ? "Filling in..." : "Auto-fill"}
            </Button>
          </div>
          <p className="mt-1.5 text-xs text-muted-foreground">
            {aiAvailable
              ? "Copies the job description and fills in the title, company, location, salary, and deadline below."
              : "Copies the job description in. Add an ANTHROPIC_API_KEY to also auto-fill the fields below."}
          </p>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="grid gap-1.5">
          <Label htmlFor="title">Job title *</Label>
          <Input id="title" name="title" value={title} onChange={(e) => setTitle(e.target.value)} required />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="company">Company *</Label>
          <Input
            id="company"
            name="company"
            list="employer-names"
            value={company}
            onChange={(e) => setCompany(e.target.value)}
            required
          />
        </div>
      </div>

      {duplicateMatches.length > 0 && (
        <div className="flex gap-2 rounded-lg border border-amber-300/60 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
          <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />
          <p>
            You already have {duplicateMatches.length === 1 ? "an open application" : `${duplicateMatches.length} open applications`} with{" "}
            {company.trim()}: {duplicateMatches.map((m) => `${m.title} (${applicationStatusLabels[m.status] ?? m.status})`).join(", ")}.
            This might be a duplicate, or just another role there, either is fine.
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="grid gap-1.5">
          <Label htmlFor="location">Location</Label>
          <Input id="location" name="location" value={location} onChange={(e) => setLocation(e.target.value)} />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="salary">Salary / stipend</Label>
          <Input id="salary" name="salary" placeholder="e.g. £24,000" value={salary} onChange={(e) => setSalary(e.target.value)} />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="grid gap-1.5">
          <Label htmlFor="jobUrl">Job listing URL</Label>
          <Input id="jobUrl" name="jobUrl" value={jobUrl} onChange={(e) => setJobUrl(e.target.value)} />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="source">Source</Label>
          <Input id="source" name="source" placeholder="e.g. university portal, LinkedIn" defaultValue={application?.source ?? ""} />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="grid gap-1.5">
          <Label htmlFor="status">Status</Label>
          <Select name="status" defaultValue={application?.status ?? "INTERESTED"}>
            <SelectTrigger id="status" className="w-full">
              <SelectValue>{(value: string) => applicationStatusLabels[value] ?? value}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              {Object.entries(applicationStatusLabels).map(([value, label]) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="priority">Priority</Label>
          <Select name="priority" defaultValue={application?.priority ?? "MEDIUM"}>
            <SelectTrigger id="priority" className="w-full">
              <SelectValue>{(value: string) => priorityLabels[value] ?? value}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              {Object.entries(priorityLabels).map(([value, label]) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="deadline">Application deadline</Label>
          <Input id="deadline" name="deadline" type="date" value={deadline} onChange={(e) => setDeadline(e.target.value)} />
        </div>
      </div>

      <div className="grid gap-1.5">
        <Label htmlFor="description">Job description</Label>
        <Textarea
          id="description"
          name="description"
          rows={6}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Paste the job posting here. Used as input when tailoring your CV and cover letter."
        />
      </div>

      <div className="grid gap-1.5">
        <Label htmlFor="notes">Notes</Label>
        <Textarea id="notes" name="notes" rows={3} defaultValue={application?.notes ?? ""} />
      </div>

      <div className="flex gap-2 pt-2">
        <Button type="submit">{application ? "Save Changes" : "Create Application"}</Button>
      </div>
    </form>
  );
}
