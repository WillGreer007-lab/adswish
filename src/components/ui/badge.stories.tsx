import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { Badge } from "@/components/ui/badge";

const meta: Meta<typeof Badge> = {
  title: "UI/Badge",
  component: Badge,
  parameters: { layout: "centered" },
  tags: ["autodocs"],
  argTypes: {
    variant: {
      control: "select",
      options: [
        "default",
        "secondary",
        "destructive",
        "success",
        "warning",
        "paymentFixed",
        "paymentAffiliate",
        "paymentHybrid",
        "outline",
      ],
    },
  },
};

export default meta;
type Story = StoryObj<typeof Badge>;

export const Default: Story = { args: { children: "Default", variant: "default" } };

export const PaymentFixed: Story = {
  args: { children: "Fixed", variant: "paymentFixed" },
};

export const PaymentAffiliate: Story = {
  args: { children: "Affiliate", variant: "paymentAffiliate" },
};

export const PaymentHybrid: Story = {
  args: { children: "Hybrid", variant: "paymentHybrid" },
};

export const Success: Story = {
  args: { children: "Active", variant: "success" },
};

export const Warning: Story = {
  args: { children: "Pending", variant: "warning" },
};

export const Destructive: Story = {
  args: { children: "Offline", variant: "destructive" },
};

export const Secondary: Story = {
  args: { children: "Draft", variant: "secondary" },
};

export const Outline: Story = {
  args: { children: "Example campaigns", variant: "outline" },
};
