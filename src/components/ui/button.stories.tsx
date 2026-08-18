import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { Button } from "@/components/ui/button";
import { ArrowRight, Check } from "lucide-react";

const meta: Meta<typeof Button> = {
  title: "UI/Button",
  component: Button,
  parameters: { layout: "centered" },
  tags: ["autodocs"],
  argTypes: {
    variant: {
      control: "select",
      options: ["default", "outline", "ghost", "destructive", "secondary", "link"],
    },
    size: {
      control: "select",
      options: ["default", "sm", "lg", "icon"],
    },
  },
};

export default meta;
type Story = StoryObj<typeof Button>;

export const Default: Story = {
  args: { children: "Get Started Free" },
};

export const Outline: Story = {
  args: { children: "Join as a Creator", variant: "outline" },
};

export const Ghost: Story = {
  args: { children: "Log in", variant: "ghost" },
};

export const Destructive: Story = {
  args: { children: "Delete Campaign", variant: "destructive" },
};

export const Small: Story = {
  args: { children: "Apply", size: "sm" },
};

export const Large: Story = {
  args: { children: "Start a Campaign", size: "lg" },
};

export const WithIcon: Story = {
  args: { children: (<>Continue <ArrowRight className="h-4 w-4" /></>) },
};

export const Success: Story = {
  args: { children: (<>Approved <Check className="h-4 w-4" /></>) },
};
