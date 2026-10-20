"use client";

import { Button } from "@/components/Button";

/**
 * The one interactive piece of a receipt. Kept in its own client file so
 * the receipt itself renders on the server and no record data crosses
 * into the browser as component props.
 */
export function PrintReceiptButton() {
  return <Button onClick={() => window.print()}>Print receipt</Button>;
}
