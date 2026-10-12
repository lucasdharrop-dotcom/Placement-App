"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Link2, Sparkles, Wand2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { fetchJobFromUrl, analyzeJob } from "@/lib/actions/analyze";
import type { JobAnalysis } from "@/lib/ai/analyze-job";

export function AnalyseJobForm({ aiAvailable }: { aiAvailable: boolean }) {
  const [url, setUrl] = useState("");
  const [text, setText] = useState("");
  const [result, setResult] = useState<JobAnalysis | null>(null);
  const [autofilling, startAutofill] = useTransition();
  const [analysing, startAnalyse] = useTransition();
  const router = useRouter();

  function handleAutofill() {
    if (!url.trim()) return;
    // Job text pasted into the URL box belongs in the description box instead.
    if (!/^https?:\/\//i.test(url.trim())) {
      setText(url.trim());
      setUrl("");
      toast.info("That isn't a link, so it's been moved to the job description box.");
      return;
    }
    startAutofill(async () => {
      try {
        const { text: fetched } = await fetchJobFromUrl(url.trim());
        setText(fetched);
        toast.success("Pulled the page text. Review it below before analysing.");
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Could not fetch that URL");
      }
    });
  }

  function handleAnalyse() {
    startAnalyse(async () => {
      try {
        const analysis = await analyzeJob(text);
        setResult(analysis);
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Failed to analyse job");
      }
    });
  }

  function handleCreateApplication() {
    if (!result) return;
    const params = new URLSearchParams();
    if (result.title) params.set("title", result.title);
    if (result.company) params.set("company", result.company);
    if (result.location) params.set("location", result.location);
    if (result.salary) params.set("salary", result.salary);
    if (result.deadline) params.set("deadline", result.deadline);
    params.set("description", text);
    if (url.trim()) params.set("jobUrl", url.trim());
    router.push(`/applications/new?${params.toString()}`);
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="space-y-4 pt-6">
          <div className="grid gap-1.5">
            <Label htmlFor="job-url">Import from URL</Label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Link2 className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="job-url"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="https://jobs.lever.co/..."
                  className="pl-8"
                />
              </div>
              <Button type="button" variant="outline" disabled={!url.trim() || autofilling} onClick={handleAutofill}>
                <Wand2 className="h-4 w-4" />
                {autofilling ? "Fetching..." : "Auto-fill"}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">Paste a job posting link and we&apos;ll pull the description for you.</p>
          </div>

          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <div className="h-px flex-1 bg-border" />
            or paste manually
            <div className="h-px flex-1 bg-border" />
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="job-description">Job description</Label>
            <Textarea
              id="job-description"
              rows={12}
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Paste the full job description here, including company name, role, requirements, skills, salary, deadline..."
            />
            <p className="text-xs text-muted-foreground">{text.length} characters</p>
          </div>

          <Button
            type="button"
            className="w-full"
            disabled={!text.trim() || analysing || !aiAvailable}
            onClick={handleAnalyse}
          >
            <Sparkles className="h-4 w-4" />
            {!aiAvailable ? "AI not configured" : analysing ? "Analysing..." : "Analyse Job"}
          </Button>
        </CardContent>
      </Card>

      {!aiAvailable && (
        <p className="text-sm text-muted-foreground">
          Add <code className="rounded bg-muted px-1 py-0.5">ANTHROPIC_API_KEY</code> to <code className="rounded bg-muted px-1 py-0.5">.env</code> to enable analysis.
          You can still paste a description and create the application manually.
        </p>
      )}

      {result && (
        <Card>
          <CardContent className="space-y-3 pt-6">
            <h3 className="font-semibold">{result.title || "Untitled role"}</h3>
            <p className="text-sm text-muted-foreground">{result.company || "Unknown company"}</p>
            <p className="text-sm">{result.summary}</p>
            <div className="flex flex-wrap gap-1.5">
              {result.location && <Badge variant="outline">{result.location}</Badge>}
              {result.salary && <Badge variant="outline">{result.salary}</Badge>}
              {result.deadline && <Badge variant="outline">Deadline {result.deadline}</Badge>}
            </div>
            {result.keySkills?.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {result.keySkills.map((skill) => (
                  <Badge key={skill} variant="secondary">
                    {skill}
                  </Badge>
                ))}
              </div>
            )}
            <Button type="button" onClick={handleCreateApplication}>
              Create Application from this
            </Button>
          </CardContent>
        </Card>
      )}

      <p className="text-sm text-muted-foreground">
        <strong>Tip:</strong> Copy the full job description from the careers page or job board. The more detail you
        include, the more accurate the extracted details will be.
      </p>
    </div>
  );
}
