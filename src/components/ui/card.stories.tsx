import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

const meta: Meta<typeof Card> = {
  title: "UI/Card",
  component: Card,
  parameters: { layout: "centered" },
  tags: ["autodocs"],
};

export default meta;
type Story = StoryObj<typeof Card>;

export const Default: Story = {
  render: () => (
    <Card className="w-80">
      <CardHeader>
        <CardTitle>Campaign Card</CardTitle>
        <CardDescription>Summer Glow Collection</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex items-center justify-between">
          <Badge variant="paymentAffiliate">Affiliate</Badge>
          <span className="text-sm text-muted-foreground">GlossyCo</span>
        </div>
        <div className="mt-4 border-t border-border pt-3">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">
            Creators earned
          </p>
          <p className="font-mono text-2xl font-bold">$12,450</p>
        </div>
      </CardContent>
      <CardFooter>
        <Button className="w-full">View Campaign</Button>
      </CardFooter>
    </Card>
  ),
};

export const EmptyState: Story = {
  render: () => (
    <Card className="w-80 border-dashed">
      <CardContent className="flex flex-col items-center justify-center py-12">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
          <span className="text-2xl">+</span>
        </div>
        <p className="mt-4 text-sm font-medium">No campaigns yet</p>
        <p className="mt-1 text-xs text-muted-foreground">
          Create your first campaign to get started
        </p>
        <Button className="mt-4" size="sm">New Campaign</Button>
      </CardContent>
    </Card>
  ),
};
