The share cards of the timeline: its section, and an event with or without a picture.

They use the frame described in `ShareCardBible`, with the right half given to pictures. Every event of the timeline names pictures; the card shows one when its file can be fetched and falls back on the plain frame when it cannot.

- **The section** sets its title and its figures on the left half and the pictures of six of its thirteen periods on the right half, in two rows of three, each in a white frame with `radius-xl` corners, slightly turned, with the name of its period in a pill. The pictures are the files of `apps/site/public/images/timeline/`: they were drawn as a set, in one palette, which the pictures of the events were not.
- **An event with a picture** sets its name at 120px, its dates in the chip and an excerpt of three lines at most on the left half, and its first picture on the right half, in the same white frame. The picture is its `w1200` copy on our media host (ADR-0080).
- **An event without a picture** keeps the whole width: its name, then an excerpt of two lines.

A picture is cropped to fill its frame, never stretched. A card with pictures is a JPEG or a PNG of more than 300 KB: it is the one exception to the flat image.

The consumer provides the name, the dates as the page prints them, the first sentences of the description and the file name of the first picture.
