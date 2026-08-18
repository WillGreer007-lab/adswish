import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { Skeleton } from "@/components/ui/skeleton";

const meta: Meta<typeof Skeleton> = {
  title: "UI/Skeleton",
  component: Skeleton,
  parameters: { layout: "centered" },
  tags: ["autodocs"],
};

export default meta;
type Story = StoryObj<typeof Skeleton>;

export const Default: Story = {
  render: () => (
    <div className="w-80 space-y-3">
      <Skeleton className="h-12 w-full rounded-lg" />
      <Skeleton className="h-4 w-3/4" />
      <Skeleton className="h-4 w-1/2" />
      <div className="flex gap-3">
        <Skeleton className="h-8 w-24 rounded-md" />
        <Skeleton className="h-8 w-24 rounded-md" />
      </div>
    </div>
  ),
};

export const CampaignCardSkeleton: Story = {
  render: () => (
    <div className="w-80 rounded-lg border border-border p-5 shadow-sm">
      <div className="mb-3 flex items-center justify-between">
        <Skeleton className="h-5 w-20 rounded-full" />
      </div>
      <Skeleton className="mb-2 h-5 w-3/4" />
      <Skeleton className="mb-4 h-3 w-1/2" />
      <div className="border-t border-border pt-3">
        <Skeleton className="mb-2 h-3 w-24" />
        <Skeleton className="h-8 w-32" />
      </div>
    </div>
  ),
};
