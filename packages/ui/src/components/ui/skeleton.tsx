// Square UI Files, MIT, 192f96aecf599848cad09118c33afe70f1067ae5. See packages/ui/licenses/SQUARE-UI-MIT.txt.
import { cn } from "../../lib/utils";

function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="skeleton"
      className={cn("bg-accent animate-pulse rounded-md", className)}
      {...props}
    />
  );
}

export { Skeleton };
