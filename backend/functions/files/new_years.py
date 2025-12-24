import datetime
import re


# List of grades in order
grades_list = [
    "Pre-School - Age 3",
    "Pre-School - Age 4",
    "Kindergarten",
    "1st Grade",
    "2nd Grade",
    "3rd Grade",
    "4th Grade",
    "5th Grade",
    "6th Grade",
    "7th Grade",
    "8th Grade",
    "9th Grade",
    "10th Grade",
    "11th Grade",
    "12th Grade",
    "College",
]


def clean_student_data(student_data: dict) -> dict:
    """
    Cleans student data by removing entries for the current year and advancing the grade.
    :param student_data: Dictionary containing student data.
    :return: Cleaned student data dictionary.   
    """
    
    current_year = datetime.datetime.now().year
    cleaned = {}
    for key, val in student_data.items():
        if key.lower() == "birthday":
            cleaned[key] = val
        elif re.fullmatch(r"\d{2}-\d{2}-\d{4}", key):
            year = int(key.split("-")[2])
            if year == current_year:
                cleaned[key] = val
        else:
            cleaned[key] = val

    grade = cleaned.get("grade")
    if grade in grades_list and grade != "College":
        cleaned["grade"] = grades_list[grades_list.index(grade) + 1]
    return cleaned


def move_and_clean_students(church_ref: str, class_name: str) -> None:
    """
    Moves and cleans student data for the given church and class.
    :param church_ref: Reference to the church Firestore document.
    :param class_name: Name of the class collection.
    :return: None
    """
    cls = church_ref.collection(class_name)
    # Walk backwards through grades, skipping 'College'
    for i in reversed(range(1, len(grades_list))):
        current, prev = grades_list[i], grades_list[i - 1]
        if current != "College" or current != "5:00-5:30" or current != "5:30-6:00":
            # 1) wipe out existing
            for s in cls.document(current).collection("students").stream():
                s.reference.delete()
            # 2) copy + clean from prev
            for s in cls.document(prev).collection("students").stream():
                cls.document(current).collection("students").document(s.id).set(
                    clean_student_data(s.to_dict())
                )

    # finally, clear Pre-School - Age 3
    for s in cls.document(grades_list[0]).collection("students").stream():
        s.reference.delete()
