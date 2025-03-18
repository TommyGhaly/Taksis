# Taksis: Church Scheduling & Management App

Taksis is a church management and scheduling application designed to automate deacon scheduling, sunday school attendance, altar serving, and overall church administrative tasks. 
It was built by Tommy Ghaly, Marrio Jeyakumar, and David Gobran to initially service St Philopater & St Mina Coptic Orthodox Church of Wayland and has since been expanded to serve 2500+ people across multiple church communities. 

---

## Key Features

- **Dynamic Scheduling:**  
  The app calculates and sorts deacons based on multiple factors (age, experience, frequency of service, weeks since last service) to determine the most suitable candidates for each liturgical role. Various algorithms (e.g., *matins*, *third*, *sixth*, *gospel*, *altar*) ensure fair rotation and optimal scheduling.

- **Attendance Management:**  
  Taksis keeps track of attendance history and provides detailed records for individual deacons and groups, helping administrators monitor participation and performance.

- **User & Role Management:**  
  The app allows users to update their profiles, manage roles, add children to their accounts, and switch between different church services such as Sunday School, Servants Meeting, and Alhan (music-related services).

- **Real-Time Updates:**  
  Utilizing Firebase Cloud Functions and Firestore, Taksis ensures that scheduling and attendance data are updated in real time, making it responsive to last-minute changes.

- **Modular & Scalable Architecture:**  
  The project is organized with a clear separation of concerns, featuring dedicated folders for backend functions, components, and screens. This modular approach simplifies future enhancements and maintenance.

---

## Project Structure

The project is divided into several key directories:

- **backend:**  
  Contains Firebase Cloud Functions (e.g., scheduling logic, user updates, attendance setup) written in Python. These functions interact with Firestore to update and maintain church data.

- **components:**  
  Includes reusable UI components such as attendance history displays, checklists, and custom headers. These components are built using React Native.

- **screens:**  
  Houses the different screens and navigators for various sections of the app:
  - **Alhan:** Attendance and grading for liturgical music.
  - **Home:** Main dashboard and navigation.
  - **LearnIt:** Educational modules related to church liturgy.
  - **ServantsMeeting:** Tools for managing servant meetings and attendance.
  - **Settings:** User and account management interfaces.
  - **SundaySchool:** Attendance and grading for Sunday School classes.

- **Global Files:**  
  Files like `App.js`, `index.js`, and configuration files (`babel.config.js`, `metro.config.js`) set up the overall project and app behavior.

---

## How It Works

1. **Deacon Scheduling:**  
   The backend uses several Python functions to compute a "value" for each deacon based on:
   - **Weeks Since Last Service:** Incentivizes those who haven’t served recently.
   - **Age & Experience:** Ensures age-appropriate assignments.
   - **Service Frequency:** Adjusts scheduling based on how often a deacon serves.
   - **Role-Specific Adjustments:** Different roles (e.g., altar service, gospel reading) have tailored algorithms.

   Once computed, deacons are sorted, and the top candidates are selected for each role.

2. **Attendance Tracking:**  
   Frontend components such as `attendanceHistory.js` and `attendenceList.js` provide visual records of deacon attendance, allowing administrators to monitor engagement over time.

3. **User Management:**  
   Through settings screens, users can update their personal information, manage child accounts, and adjust their service roles. The app synchronizes these updates across Firestore, ensuring consistent data.

4. **Real-Time Data Updates:**  
   Firebase Cloud Functions are triggered both on a schedule (e.g., every Sunday) and on-demand to update schedules, reset week counts, and reflect the latest attendance data.

---

## Tools and Technologies

- **React Native:**  
  Used for building the cross-platform mobile app. It powers the user interface with modular components and navigators.

- **Firebase & Firestore:**  
  Firebase Cloud Functions (written in Python) handle backend logic, and Firestore serves as the NoSQL database for storing church, user, and scheduling data.

- **Python:**  
  Backend functions, including scheduling algorithms and data management routines, are written in Python, leveraging libraries such as `firebase_admin` and `google.cloud.firestore`.

- **Microsoft Live Share:**  
  Collaborative development was made seamless by using Microsoft Live Share, which allowed real-time code sharing and collaboration among the development team.

- **Version Control & Collaboration:**  
  The project was developed using modern version control systems and collaborative tools, ensuring efficient teamwork and code quality.

---

## License


This project is licensed under the [MIT License](LICENSE).

---

Taksis aims to modernize church management by offering a dynamic, efficient, and user-friendly solution for scheduling and attendance tracking. Enjoy using Taksis to help streamline church operations and enhance community engagement!

Feel free to reach out with any questions or feedback.
