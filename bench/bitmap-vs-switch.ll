define i8 @llparse__bench_switch(i8* %p, i8* %endp) nounwind minsize ssp uwtable {
start:
  br label %loop

loop:
  %current = phi i8* [ %p, %start ], [ %next, %match ]
  ; --- Prologue ---
  ; if (pos != endpos)
  %i0 = icmp ne i8* %current, %endp
  br i1 %i0, label %has_data, label %no_data

has_data:
  ; node.Single
  %c = load i8, i8* %current
  switch i8 %c, label %no_match [ i8 9 , label %match i8 12 , label %match i8 33 , label %match i8 34 , label %match i8 36 , label %match i8 37 , label %match i8 38 , label %match i8 39 , label %match i8 40 , label %match i8 41 , label %match i8 42 , label %match i8 43 , label %match i8 44 , label %match i8 45 , label %match i8 46 , label %match i8 47 , label %match i8 48 , label %match i8 49 , label %match i8 50 , label %match i8 51 , label %match i8 52 , label %match i8 53 , label %match i8 54 , label %match i8 55 , label %match i8 56 , label %match i8 57 , label %match i8 58 , label %match i8 59 , label %match i8 60 , label %match i8 61 , label %match i8 62 , label %match i8 64 , label %match i8 65 , label %match i8 66 , label %match i8 67 , label %match i8 68 , label %match i8 69 , label %match i8 70 , label %match i8 71 , label %match i8 72 , label %match i8 73 , label %match i8 74 , label %match i8 75 , label %match i8 76 , label %match i8 77 , label %match i8 78 , label %match i8 79 , label %match i8 80 , label %match i8 81 , label %match i8 82 , label %match i8 83 , label %match i8 84 , label %match i8 85 , label %match i8 86 , label %match i8 87 , label %match i8 88 , label %match i8 89 , label %match i8 90 , label %match i8 91 , label %match i8 92 , label %match i8 93 , label %match i8 94 , label %match i8 95 , label %match i8 96 , label %match i8 97 , label %match i8 98 , label %match i8 99 , label %match i8 100 , label %match i8 101 , label %match i8 102 , label %match i8 103 , label %match i8 104 , label %match i8 105 , label %match i8 106 , label %match i8 107 , label %match i8 108 , label %match i8 109 , label %match i8 110 , label %match i8 111 , label %match i8 112 , label %match i8 113 , label %match i8 114 , label %match i8 115 , label %match i8 116 , label %match i8 117 , label %match i8 118 , label %match i8 119 , label %match i8 120 , label %match i8 121 , label %match i8 122 , label %match i8 123 , label %match i8 125 , label %match i8 126 , label %match ]
no_match:
  ret i8 0
match:
  ; next = pos + 1
  %next = getelementptr inbounds i8, i8* %current, i32 1
  br label %loop

no_data:
  ret i8 1
}
