import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import * as React from "react";

export class ErrorBoundary extends React.Component<{ children: React.ReactNode }, { err: Error | null }> {
  state = { err: null as Error | null };

  static getDerivedStateFromError(err: Error) {
    return { err };
  }

  render() {
    if (this.state.err) {
      return (
        <div className="flex min-h-[40vh] items-center justify-center p-6">
          <Card className="max-w-md">
            <CardHeader>
              <CardTitle className="text-base">Error</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-slate-600">{this.state.err.message}</p>
              <Button type="button" variant="secondary" onClick={() => window.location.reload()}>
                Recargar
              </Button>
            </CardContent>
          </Card>
        </div>
      );
    }
    return this.props.children;
  }
}
