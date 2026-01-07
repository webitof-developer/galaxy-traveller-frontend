import { Calendar, Clock, ArrowRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { formatDate } from "@/lib/date";
import Link from "next/link";

export const BlogCard = ({
  id,
  title,
  excerpt,
  image,
  category,
  date,
  readTime,
  author,
}) => {
  const formattedDate = formatDate(date);
  console.log({ formattedDate });
  return (
    <Card className="overflow-hidden p-0 hover-lift border-0 shadow-md group h-full flex flex-col">
      <Link href={`/blogs/${id}`} className="flex flex-col h-full">
        <div className="relative h-56 overflow-hidden flex-shrink-0">
          <img
            src={image}
            alt={title}
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
          />
          {category && (
            <div className="absolute top-4 left-4 z-20">
              <Badge className="bg-primary text-primary-foreground shadow-lg">
                {category}
              </Badge>
            </div>
          )}
        </div>

        <div className="p-6 flex flex-col flex-grow">
          <div className="flex items-center gap-4 text-xs text-muted-foreground mb-3">
            <div className="flex items-center gap-1">
              <Calendar className="h-3.5 w-3.5" />
              <span>{`${formattedDate.day} ${formattedDate.month} ${formattedDate.year}`}</span>
            </div>
            {readTime && (
              <div className="flex items-center gap-1">
                <Clock className="h-3.5 w-3.5" />
                <span>{readTime}</span>
              </div>
            )}
          </div>

          <h3 className="font-heading text-xl font-bold mb-2 line-clamp-2 group-hover:text-primary transition-colors">
            {title}
          </h3>

          <p className="text-sm text-muted-foreground mb-4 line-clamp-3 flex-grow">
            {excerpt}
          </p>

          <div className="flex items-center justify-between mt-auto">
            <span className="text-sm font-medium">By {author}</span>

            <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center group-hover:bg-primary group-hover:w-16 transition-all duration-300 overflow-hidden">
              <ArrowRight className="h-4 w-4 text-primary group-hover:text-primary-foreground transition-all group-hover:translate-x-1" />
            </div>
          </div>
        </div>
      </Link>
    </Card>
  );
};
