import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";

const meta: Meta<typeof Label> = {
  title: "UI/Label",
  component: Label,
  parameters: { layout: "centered" },
  tags: ["autodocs"],
};

export default meta;
type Story = StoryObj<typeof Label>;

export const Default: Story = {
  args: { children: "Email address" },
};

export const WithInput: Story = {
  render: () => (
    <div className="w-80 space-y-2">
      <Label htmlFor="name">Display name</Label>
      <Input id="name" placeholder="e.g. Sarah Creates" />
    </div>
  ),
};
